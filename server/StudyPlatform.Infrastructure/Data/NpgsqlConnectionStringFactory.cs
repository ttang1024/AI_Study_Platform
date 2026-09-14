using System.Data.Common;
using Microsoft.Extensions.Configuration;
using Npgsql;

namespace StudyPlatform.Infrastructure.Data;

/// <summary>
/// Turns the configured <c>ConnectionStrings:DefaultConnection</c> into the string Npgsql actually
/// opens with.
///
/// Production runs against a managed Postgres reached over the public internet (Supabase), not a
/// database on the same host, and three Npgsql defaults are wrong for that shape:
///
/// <list type="bullet">
/// <item><b>Maximum Pool Size = 100 per process.</b> Fine against a local server, far too many against
/// a managed instance whose whole connection budget is shared — a couple of ECS tasks would exhaust
/// it and every later connection would fail with "remaining connection slots are reserved".</item>
/// <item><b>Command Timeout = 30 s.</b> Written for a database one hop away; the heavier analytics and
/// semantic-search queries have more round-trip latency to absorb here.</item>
/// <item><b>SSL Mode.</b> A managed provider requires TLS. Npgsql will happily negotiate it, but only
/// if the connection string says so.</item>
/// </list>
///
/// Every one of these is applied <em>only when the operator has not already specified it</em>, so a
/// deliberately tuned connection string passes through untouched. Nothing here ever weakens what was
/// configured — in particular it never sets <c>Trust Server Certificate</c>, which would turn TLS into
/// encryption without authentication.
/// </summary>
public static class NpgsqlConnectionStringFactory
{
    /// <summary>
    /// Conservative for a small service on a shared managed instance: enough concurrency for the API's
    /// request load and its handful of background workers, nowhere near a provider-wide budget. Raise
    /// it with <c>Database:MaxPoolSize</c> (or in the connection string) if the service genuinely
    /// saturates it — the symptom is requests blocking in <c>Timeout</c> waiting for a free connection.
    /// </summary>
    public const int DefaultMaxPoolSize = 20;

    /// <summary>Npgsql's own default; restated so a remote DSN gets it explicitly rather than by luck.</summary>
    public const int DefaultConnectTimeoutSeconds = 15;

    public const int DefaultCommandTimeoutSeconds = 60;

    public static string Create(IConfiguration configuration, bool isProduction)
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException(
                "Database connection string 'DefaultConnection' is not configured. Set the "
                + "ConnectionStrings__DefaultConnection environment variable to the managed Postgres "
                + "connection string.");
        }

        var maxPoolSize = configuration.GetValue("Database:MaxPoolSize", DefaultMaxPoolSize);
        var commandTimeout = configuration.GetValue("Database:CommandTimeoutSeconds", DefaultCommandTimeoutSeconds);
        var connectTimeout = configuration.GetValue("Database:ConnectTimeoutSeconds", DefaultConnectTimeoutSeconds);

        return Normalize(connectionString, isProduction, maxPoolSize, commandTimeout, connectTimeout);
    }

    internal static string Normalize(
        string connectionString,
        bool isProduction,
        int maxPoolSize = DefaultMaxPoolSize,
        int commandTimeoutSeconds = DefaultCommandTimeoutSeconds,
        int connectTimeoutSeconds = DefaultConnectTimeoutSeconds)
    {
        NpgsqlConnectionStringBuilder builder;
        try
        {
            builder = new NpgsqlConnectionStringBuilder(connectionString);
        }
        catch (Exception ex) when (ex is ArgumentException or FormatException)
        {
            throw new InvalidOperationException(
                $"Database connection string 'DefaultConnection' could not be parsed: {ex.Message}", ex);
        }

        var isLocal = IsLoopback(builder.Host);

        // A Production process that silently fell back to the development default would come up
        // "healthy" against an empty local database — or, worse, quietly not be talking to the
        // database the operator thinks it is. Fail loudly instead: in Production the connection string
        // is always supplied by the environment.
        if (isProduction && isLocal)
        {
            throw new InvalidOperationException(
                "Database connection string 'DefaultConnection' points at localhost in the Production "
                + "environment. Set ConnectionStrings__DefaultConnection to the managed Postgres "
                + "connection string (for example the Supabase pooler DSN) in the deployment's "
                + "environment or secrets.");
        }

        var specified = SpecifiedKeywords(connectionString);

        if (maxPoolSize > 0 && !specified("Maximum Pool Size", "MaxPoolSize"))
            builder.MaxPoolSize = maxPoolSize;

        if (commandTimeoutSeconds > 0 && !specified("Command Timeout", "CommandTimeout"))
            builder.CommandTimeout = commandTimeoutSeconds;

        if (connectTimeoutSeconds > 0 && !specified("Timeout"))
            builder.Timeout = connectTimeoutSeconds;

        // Only for a remote server: requiring TLS to a loopback Postgres (docker compose, a dev
        // machine) would break setups that never configured a server certificate.
        if (!isLocal && !specified("SSL Mode", "SslMode"))
            builder.SslMode = SslMode.Require;

        return builder.ToString();
    }

    /// <summary>
    /// Which keywords the operator actually wrote.
    ///
    /// <see cref="NpgsqlConnectionStringBuilder"/> cannot answer this: its <c>ContainsKey</c> reports
    /// every keyword it <em>knows about</em>, specified or not, so asking it would mean never applying
    /// a default. A plain <see cref="DbConnectionStringBuilder"/> holds only what was parsed, which is
    /// the question being asked.
    /// </summary>
    private static SpecifiedKeywordPredicate SpecifiedKeywords(string connectionString)
    {
        var raw = new DbConnectionStringBuilder { ConnectionString = connectionString };
        var keys = raw.Keys
            .Cast<string>()
            .Select(Canonicalize)
            .ToHashSet(StringComparer.Ordinal);

        return aliases => aliases.Any(alias => keys.Contains(Canonicalize(alias)));
    }

    // Npgsql accepts "Maximum Pool Size" and "MaxPoolSize" for the same setting, and matches
    // case-insensitively; flattening spaces and case makes the aliases comparable.
    private static string Canonicalize(string keyword)
        => keyword.Replace(" ", string.Empty).ToLowerInvariant();

    private static bool IsLoopback(string? host)
    {
        if (string.IsNullOrWhiteSpace(host))
            return false;

        // A comma-separated host list (Npgsql multi-host) is remote unless every entry is local.
        var hosts = host.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (hosts.Length == 0)
            return false;

        return hosts.All(single =>
            single.Equals("localhost", StringComparison.OrdinalIgnoreCase)
            || single.Equals("127.0.0.1", StringComparison.Ordinal)
            || single.Equals("::1", StringComparison.Ordinal)
            // A Unix-domain socket directory: as local as it gets.
            || single.StartsWith('/'));
    }

    /// <summary>Was any of these spellings of one setting present in the configured connection string?</summary>
    private delegate bool SpecifiedKeywordPredicate(params string[] aliases);
}
