using Npgsql;

namespace GeoScope.Tests.Infrastructure;

/// <summary>Testlerde doğrulama sorguları için küçük yardımcı; yalnızca sabit SQL + parametre.</summary>
public static class Sql
{
    public static async Task<T> ScalarAsync<T>(string connectionString, string sql, params object[] parameters)
    {
        await using var conn = new NpgsqlConnection(connectionString);
        await conn.OpenAsync();
        await using var cmd = new NpgsqlCommand(sql, conn);
        foreach (var p in parameters) cmd.Parameters.AddWithValue(p);
        var result = await cmd.ExecuteScalarAsync();
        return (T)Convert.ChangeType(result!, typeof(T));
    }

    public static async Task ExecAsync(string connectionString, string sql, params object[] parameters)
    {
        await using var conn = new NpgsqlConnection(connectionString);
        await conn.OpenAsync();
        await using var cmd = new NpgsqlCommand(sql, conn);
        foreach (var p in parameters) cmd.Parameters.AddWithValue(p);
        await cmd.ExecuteNonQueryAsync();
    }
}
