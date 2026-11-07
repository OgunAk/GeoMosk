using Microsoft.AspNetCore.OpenApi;
using Microsoft.OpenApi.Models;
using NetTopologySuite.Geometries;

namespace GeoMosk.Api.OpenApi;

/// <summary>
/// NTS Geometry sınıfının iç alanları (Envelope, Factory…) yerine GeoJSON geometri şeması yayımlar;
/// gerçek serileştirme GeoJsonConverterFactory ile yapılır.
/// </summary>
internal sealed class GeometrySchemaTransformer : IOpenApiSchemaTransformer
{
    public Task TransformAsync(OpenApiSchema schema, OpenApiSchemaTransformerContext context, CancellationToken cancellationToken)
    {
        if (typeof(Geometry).IsAssignableFrom(context.JsonTypeInfo.Type))
        {
            schema.Properties.Clear();
            schema.AllOf.Clear();
            schema.Type = "object";
            schema.Description = "RFC 7946 GeoJSON geometri nesnesi (EPSG:4326, [boylam, enlem]).";
            schema.Required = new HashSet<string> { "type", "coordinates" };
            schema.Properties["type"] = new OpenApiSchema { Type = "string" };
            schema.Properties["coordinates"] = new OpenApiSchema { Type = "array", Items = new OpenApiSchema() };
        }
        return Task.CompletedTask;
    }
}
