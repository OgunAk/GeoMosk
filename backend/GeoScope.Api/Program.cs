using GeoScope.Api.Health;
using GeoScope.Api.OpenApi;
using GeoScope.Application.Features;
using GeoScope.Infrastructure;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using NetTopologySuite.IO.Converters;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("GeoScope")
    ?? throw new InvalidOperationException("ConnectionStrings:GeoScope yapılandırılmamış (ortam değişkeni: ConnectionStrings__GeoScope).");
builder.Services.AddInfrastructure(connectionString);
builder.Services.Configure<FeatureListOptions>(builder.Configuration.GetSection(FeatureListOptions.SectionName));

builder.Services.AddControllers()
    .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new GeoJsonConverterFactory()));
builder.Services.AddProblemDetails();
builder.Services.AddOpenApi(o => o.AddSchemaTransformer<GeometrySchemaTransformer>());
builder.Services.AddHealthChecks()
    .AddCheck<PostGisHealthCheck>("postgis", tags: ["ready"]);

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
    policy.WithOrigins(allowedOrigins).AllowAnyHeader().WithMethods("GET", "POST", "PATCH", "DELETE")));

var app = builder.Build();

app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseCors();

app.MapOpenApi();
app.MapControllers();
// live: yalnızca süreç; ready: DB + PostGIS.
app.MapHealthChecks("/api/health/live", new HealthCheckOptions
{
    Predicate = _ => false,
    ResponseWriter = HealthResponseWriter.WriteAsync,
});
app.MapHealthChecks("/api/health/ready", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready"),
    ResponseWriter = HealthResponseWriter.WriteAsync,
});

app.Run();

public partial class Program;
