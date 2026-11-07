using GeoMosk.Api.Health;
using GeoMosk.Api.OpenApi;
using GeoMosk.Application.Features;
using GeoMosk.Infrastructure;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using NetTopologySuite.IO.Converters;

var builder = WebApplication.CreateBuilder(args);
// Gövde sınırı (security.md): 2 MiB; aşılırsa Kestrel 413 döner.
builder.WebHost.ConfigureKestrel(o => o.Limits.MaxRequestBodySize = 2 * 1024 * 1024);

var connectionString = builder.Configuration.GetConnectionString("GeoMosk")
    ?? throw new InvalidOperationException("ConnectionStrings:GeoMosk yapılandırılmamış (ortam değişkeni: ConnectionStrings__GeoMosk).");
builder.Services.AddInfrastructure(connectionString);
builder.Services.Configure<FeatureListOptions>(builder.Configuration.GetSection(FeatureListOptions.SectionName));

builder.Services.AddControllers()
    .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new GeoJsonConverterFactory()));
builder.Services.AddProblemDetails();
builder.Services.AddOpenApi(o =>
{
    o.AddSchemaTransformer<GeometrySchemaTransformer>();
    // OpenAPI başlığı derleme adı yerine sabit "GeoMosk API" olur.
    o.AddDocumentTransformer((document, _, _) =>
    {
        document.Info.Title = "GeoMosk API";
        // Varsayılan "servers" isteğin Host'undan üretilir; nginx arkasında port düşer (http://localhost) ve Swagger UI
        // istekleri yanlış adrese gönderir. Boş liste: istemci şemanın sunulduğu origin'i kullanır (5080 ya da 8080).
        document.Servers = [];
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
// Tarayıcıdan denenebilir API arayüzü (ADR-0018): /swagger. Şema kaynağı yukarıdaki /openapi/v1.json;
// arayüz dosyaları paketin içinden sunulur (CDN yok).
app.UseSwaggerUI(o =>
{
    o.SwaggerEndpoint("/openapi/v1.json", "GeoMosk API v1");
    o.RoutePrefix = "swagger";
    o.DocumentTitle = "GeoMosk API";
});
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
