using System.Diagnostics;
using Npgsql;

namespace GeoScope.Tests.Infrastructure;

/// <summary>Gerçek import script'ini (scripts/import/load-osm.mjs) alt süreç olarak çalıştırır.</summary>
public static class ImportRunner
{
    public static readonly string RepoRoot = FindRepoRoot();

    public static string Fixture(string version) => Path.Combine(RepoRoot, "data", "test-fixtures", "osm-mini", version);

    public static async Task<(int ExitCode, string StdOut, string StdErr)> RunAsync(string snapshotDir, string npgsqlConnectionString)
    {
        var psi = new ProcessStartInfo("node")
        {
            WorkingDirectory = RepoRoot,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
        };
        // Argüman dizisi: yollar shell komutuna birleştirilmez.
        psi.ArgumentList.Add(Path.Combine("scripts", "import", "load-osm.mjs"));
        psi.ArgumentList.Add("--snapshot");
        psi.ArgumentList.Add(snapshotDir);
        psi.ArgumentList.Add("--connection");
        psi.ArgumentList.Add(ToUrl(npgsqlConnectionString));

        using var process = Process.Start(psi) ?? throw new InvalidOperationException("node başlatılamadı");
        var stdout = process.StandardOutput.ReadToEndAsync();
        var stderr = process.StandardError.ReadToEndAsync();
        using var timeout = new CancellationTokenSource(TimeSpan.FromMinutes(2));
        await process.WaitForExitAsync(timeout.Token);
        return (process.ExitCode, await stdout, await stderr);
    }

    private static string ToUrl(string npgsql)
    {
        var b = new NpgsqlConnectionStringBuilder(npgsql);
        return $"postgres://{Uri.EscapeDataString(b.Username!)}:{Uri.EscapeDataString(b.Password!)}@{b.Host}:{b.Port}/{Uri.EscapeDataString(b.Database!)}";
    }

    private static string FindRepoRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "global.json")))
            dir = dir.Parent;
        return dir?.FullName ?? throw new InvalidOperationException("Depo kökü (global.json) bulunamadı.");
    }
}
