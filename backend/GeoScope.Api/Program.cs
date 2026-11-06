using GeoScope.Api.Health;
using GeoScope.Api.OpenApi;
using GeoScope.Application.Features;
using GeoScope.Infrastructure;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using NetTopologySuite.IO.Converters;

var builder = WebApplication.CreateBuilder(args);
// Gövde sınırı (security.md): 2 MiB; aşılırsa Kestrel 413 döner.
builder.WebHost.ConfigureKestrel(o => o.Limits.MaxRequestBodySize = 2 * 1024 * 1024);

var connectionString = builder.Configuration.GetConnectionString("GeoScope")
    ?? throw new InvalidOperationException("ConnectionStrings:GeoScope yapılandırılmamış (ortam değişkeni: ConnectionStrings__GeoScope).");
builder.Services.AddInfrastructure(connectionString);
builder.Services.Configure<FeatureListOptions>(builder.Configuration.GetSection(FeatureListOptions.SectionName));

builder.Services.AddControllers()
    .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new GeoJsonConverterFactory()));
builder.Services.AddProblemDetails();
builder.Services.AddOpenApi(o =>
{
    o.AddSchemaTransformer<GeometrySchemaTransformer>();
    // Görünen ad GeoMosk (ADR-0017); proje/derleme adı GeoScope.Api olarak kalır.
    o.AddDocumentTransformer((document, _, _) =>
    {
        document.Info.Title = "GeoMosk API";
        return Task.CompletedTask;
    });
});
builder.Services.AddHealthChecks()
    .AddCheck<PostGisHealthCheck>("postgis", tags: ["ready"]);

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
    // ETag çapraz origin kurulumda (VITE_API_BASE_URL) okunabilmeli; aksi halde If-Match gönderilemez.
    policy.WithOrigins(allowedOrigins).AllowAnyHeader().WithMethods("GET", "POST", "PATCH", "DELETE")
        .WithExposedHeaders("ETag", "Location")));

var app = builder.Build();

app.UseExceptionHandler(new ExceptionHandlerOptions
{
    // Kestrel istemci hatalarını (ör. 413 gövde sınırı, bozuk istek) kendi durum koduyla bildirir; 500'e çevrilmez.
    StatusCodeSelector = ex => ex is BadHttpRequestException badRequest ? badRequest.StatusCode : StatusCodes.Status500InternalServerError,
});
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
