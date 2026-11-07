using System.Text.Json;

namespace GeoMosk.Application.Features;

/// <summary>
/// Kaynak kayda yerel sözel düzenleme (PATCH). Alanın hiç gönderilmemesi "değiştirme" demektir:
/// <list type="bullet">
/// <item><c>name</c>: metin → yerel ad; <c>null</c> → yerel adı kaldır, kaynak adına dön.</item>
/// <item><c>description</c>: metin → açıklama; <c>null</c> → açıklamayı temizle.</item>
/// </list>
/// Kaynak kimliği, geometri, tür vb. alanlar istemciden değiştirilemez (allowlist).
/// </summary>
public sealed record OverridePatch(bool HasName, string? Name, bool HasDescription, string? Description);

public static class OverridePatchParser
{
    public const int MaxDescriptionLength = 2000;
    private static readonly string[] AllowedFields = ["name", "description"];

    public static (OverridePatch? Patch, Dictionary<string, string[]> Errors) Parse(JsonElement body, int maxNameLength)
    {
        var errors = new Dictionary<string, string[]>();
        if (body.ValueKind != JsonValueKind.Object)
        {
            errors[""] = ["İstek gövdesi bir JSON nesnesi olmalı."];
            return (null, errors);
        }

        foreach (var property in body.EnumerateObject())
        {
            if (!AllowedFields.Contains(property.Name))
                errors[property.Name] = ["Bu alan düzenlenemez. Düzenlenebilir alanlar: name, description."];
        }

        var (hasName, name) = ReadText(body, "name", maxNameLength, allowEmpty: false, errors);
        var (hasDescription, description) = ReadText(body, "description", MaxDescriptionLength, allowEmpty: true, errors);

        if (errors.Count == 0 && !hasName && !hasDescription)
            errors[""] = ["En az bir alan (name veya description) gönderilmeli."];

        return errors.Count > 0 ? (null, errors) : (new OverridePatch(hasName, name, hasDescription, description), errors);
    }

    private static (bool Present, string? Value) ReadText(
        JsonElement body, string field, int maxLength, bool allowEmpty, Dictionary<string, string[]> errors)
    {
        if (!body.TryGetProperty(field, out var value)) return (false, null);
        switch (value.ValueKind)
        {
            case JsonValueKind.Null:
                return (true, null);
            case JsonValueKind.String:
                var text = value.GetString()!.Trim();
                if (text.Length == 0)
                {
                    if (allowEmpty) return (true, null); // boş açıklama = temizle
                    errors[field] = [$"{field} boş olamaz; kaynak değerine dönmek için null gönderin."];
                }
                else if (text.Length > maxLength)
                {
                    errors[field] = [$"{field} en çok {maxLength} karakter olabilir."];
                }
                return (true, text.Length == 0 ? null : text);
            default:
                errors[field] = [$"{field} metin veya null olmalı."];
                return (true, null);
        }
    }
}
