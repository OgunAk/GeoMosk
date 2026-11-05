using System.Text.Json;
using NetTopologySuite.Geometries;

namespace GeoScope.Application.UserFeatures;

public sealed record UserFeatureCreate(string Name, string? Description, Geometry Geometry);

/// <summary>PATCH: gönderilmeyen alan değişmez. <c>description: null</c> temizler; ad ve geometri null olamaz.</summary>
public sealed record UserFeaturePatch(string? Name, bool HasDescription, string? Description, Geometry? Geometry);

/// <summary>Doğrulama sonucu: biçim hataları 400, geometri anlam hataları 422.</summary>
public sealed record RequestErrors(Dictionary<string, string[]> Errors, bool Unprocessable)
{
    public static RequestErrors Empty => new([], false);
    public bool Any => Errors.Count > 0;
}

public static class UserFeatureRequestParser
{
    /// <summary>Geliştirici kuralı (kontrol noktası 2): boşluklar kırpıldıktan sonra en az 3 karakter.</summary>
    public const int MinNameLength = 3;
    public const int MaxNameLength = 200;
    public const int MaxDescriptionLength = 2000;

    /// <summary>POST gövdesi: RFC 7946 Feature — <c>{"type":"Feature","geometry":{…},"properties":{"name":…,"description"?:…}}</c>.</summary>
    public static (UserFeatureCreate? Value, RequestErrors Errors) ParseCreate(JsonElement body)
    {
        var errors = new Dictionary<string, string[]>();
        if (body.ValueKind != JsonValueKind.Object)
            return (null, new(new() { [""] = ["Gövde bir GeoJSON Feature nesnesi olmalı."] }, false));
        if (!body.TryGetProperty("type", out var type) || type.ValueKind != JsonValueKind.String || type.GetString() != "Feature")
            errors["type"] = ["type \"Feature\" olmalı."];
        foreach (var p in body.EnumerateObject())
        {
            if (p.Name is not ("type" or "geometry" or "properties" or "id"))
                errors[p.Name] = ["Bu alan kabul edilmez."];
        }
        if (body.TryGetProperty("id", out _))
            errors["id"] = ["id sunucu tarafından atanır; gönderilmemeli."];

        string? name = null, description = null;
        if (!body.TryGetProperty("properties", out var props) || props.ValueKind != JsonValueKind.Object)
        {
            errors["properties"] = ["properties nesne olmalı ve name içermeli."];
        }
        else
        {
            foreach (var p in props.EnumerateObject())
            {
                if (p.Name is not ("name" or "description"))
                    errors[$"properties.{p.Name}"] = ["Bu alan kabul edilmez. İzin verilenler: name, description."];
            }
            name = ReadName(props, required: true, errors);
            (_, description) = ReadDescription(props, errors);
        }

        Geometry? geometry = null;
        var unprocessable = false;
        if (!body.TryGetProperty("geometry", out var geometryElement) || geometryElement.ValueKind == JsonValueKind.Null)
        {
            errors["geometry"] = ["geometry zorunlu."];
        }
        else
        {
            var parsed = UserGeometryParser.Parse(geometryElement);
            if (parsed.Error is not null)
            {
                errors["geometry"] = [parsed.Error];
                unprocessable = !parsed.Malformed;
            }
            geometry = parsed.Geometry;
        }

        // Biçim hatası varsa 400 öncelikli; yalnız geometri anlamı hatalıysa 422.
        var onlyGeometry = errors.Count == 1 && errors.ContainsKey("geometry");
        if (errors.Count > 0) return (null, new(errors, unprocessable && onlyGeometry));
        return (new UserFeatureCreate(name!, description, geometry!), RequestErrors.Empty);
    }

    /// <summary>PATCH gövdesi: <c>{"name"?, "description"?, "geometry"?}</c> düz nesne (kaynak katman PATCH'i ile aynı biçim).</summary>
    public static (UserFeaturePatch? Value, RequestErrors Errors) ParsePatch(JsonElement body)
    {
        var errors = new Dictionary<string, string[]>();
        if (body.ValueKind != JsonValueKind.Object)
            return (null, new(new() { [""] = ["Gövde bir JSON nesnesi olmalı."] }, false));
        foreach (var p in body.EnumerateObject())
        {
            if (p.Name is not ("name" or "description" or "geometry"))
                errors[p.Name] = ["Bu alan düzenlenemez. Düzenlenebilir alanlar: name, description, geometry."];
        }

        string? name = null;
        if (body.TryGetProperty("name", out _)) name = ReadName(body, required: true, errors);
        var (hasDescription, description) = ReadDescription(body, errors);

        Geometry? geometry = null;
        var unprocessable = false;
        if (body.TryGetProperty("geometry", out var geometryElement))
        {
            if (geometryElement.ValueKind == JsonValueKind.Null)
            {
                errors["geometry"] = ["geometry null olamaz; kaydı silmek için DELETE kullanın."];
            }
            else
            {
                var parsed = UserGeometryParser.Parse(geometryElement);
                if (parsed.Error is not null)
                {
                    errors["geometry"] = [parsed.Error];
                    unprocessable = !parsed.Malformed;
                }
                geometry = parsed.Geometry;
            }
        }

        if (errors.Count == 0 && name is null && !hasDescription && geometry is null)
            errors[""] = ["En az bir alan (name, description veya geometry) gönderilmeli."];

        var onlyGeometry = errors.Count == 1 && errors.ContainsKey("geometry");
        if (errors.Count > 0) return (null, new(errors, unprocessable && onlyGeometry));
        return (new UserFeaturePatch(name, hasDescription, description, geometry), RequestErrors.Empty);
    }

    private static string? ReadName(JsonElement obj, bool required, Dictionary<string, string[]> errors)
    {
        if (!obj.TryGetProperty("name", out var value))
        {
            if (required) errors["name"] = ["name zorunlu."];
            return null;
        }
        if (value.ValueKind != JsonValueKind.String)
        {
            errors["name"] = ["name metin olmalı (boş veya null olamaz)."];
            return null;
        }
        var text = value.GetString()!.Trim();
        if (text.Length == 0) errors["name"] = ["name boş olamaz."];
        else if (new System.Globalization.StringInfo(text).LengthInTextElements < MinNameLength)
            errors["name"] = [$"name en az {MinNameLength} karakter olmalı (baştaki/sondaki boşluklar sayılmaz)."];
        else if (text.Length > MaxNameLength) errors["name"] = [$"name en çok {MaxNameLength} karakter olabilir."];
        return text.Length == 0 ? null : text;
    }

    private static (bool Present, string? Value) ReadDescription(JsonElement obj, Dictionary<string, string[]> errors)
    {
        if (!obj.TryGetProperty("description", out var value)) return (false, null);
        if (value.ValueKind == JsonValueKind.Null) return (true, null);
        if (value.ValueKind != JsonValueKind.String)
        {
            errors["description"] = ["description metin veya null olmalı."];
            return (true, null);
        }
        var text = value.GetString()!.Trim();
        if (text.Length > MaxDescriptionLength) errors["description"] = [$"description en çok {MaxDescriptionLength} karakter olabilir."];
        return (true, text.Length == 0 ? null : text);
    }
}
