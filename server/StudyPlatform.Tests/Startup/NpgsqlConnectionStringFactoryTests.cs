using Microsoft.Extensions.Configuration;
using Npgsql;
using StudyPlatform.Infrastructure.Data;
using Xunit;

namespace StudyPlatform.Tests.Startup;

/// <summary>
/// The API talks to a managed Postgres over the public internet in production (Supabase), and to a
/// local one in development. These pin the defaults that differ between the two, and the rule that
/// binds them: anything the operator wrote in the connection string wins.
/// </summary>
public class NpgsqlConnectionStringFactoryTests
{
    private const string Supabase =
        "Host=aws-0-ap-southeast-2.pooler.supabase.com;Port=5432;Database=postgres;Username=postgres.abcdefghijklm;Password=s3cret";

    private static NpgsqlConnectionStringBuilder Normalize(string connectionString, bool isProduction = true)
        => new(NpgsqlConnectionStringFactory.Normalize(connectionString, isProduction));

    [Fact]
    public void AppliesConservativeDefaultsToARemoteDatabase()
    {
        var result = Normalize(Supabase);

        // Npgsql's own default is 100 connections per process, which a couple of ECS tasks would use
        // to exhaust a managed instance's whole connection budget.
        Assert.Equal(NpgsqlConnectionStringFactory.DefaultMaxPoolSize, result.MaxPoolSize);
        Assert.Equal(NpgsqlConnectionStringFactory.DefaultCommandTimeoutSeconds, result.CommandTimeout);
        Assert.Equal(NpgsqlConnectionStringFactory.DefaultConnectTimeoutSeconds, result.Timeout);
        // Require = TLS is mandatory. Npgsql's stronger modes (VerifyCA / VerifyFull) additionally
        // validate the server certificate and stay available through the connection string; nothing
        // here ever weakens what the operator asked for.
        Assert.Equal(SslMode.Require, result.SslMode);
    }

    [Fact]
    public void KeepsTheHostDatabaseAndCredentialsUntouched()
    {
        var result = Normalize(Supabase);

        Assert.Equal("aws-0-ap-southeast-2.pooler.supabase.com", result.Host);
        Assert.Equal(5432, result.Port);
        Assert.Equal("postgres", result.Database);
        Assert.Equal("postgres.abcdefghijklm", result.Username);
        Assert.Equal("s3cret", result.Password);
    }

    [Theory]
    [InlineData("Maximum Pool Size=60")]
    [InlineData("MaxPoolSize=60")]
    [InlineData("maximum pool size=60")]
    public void DoesNotOverrideAnExplicitPoolSize(string clause)
    {
        // Npgsql spells this two ways and matches case-insensitively; all of them must count as
        // "the operator chose a pool size".
        Assert.Equal(60, Normalize($"{Supabase};{clause}").MaxPoolSize);
    }

    [Theory]
    [InlineData("Command Timeout=15")]
    [InlineData("CommandTimeout=15")]
    public void DoesNotOverrideAnExplicitCommandTimeout(string clause)
    {
        Assert.Equal(15, Normalize($"{Supabase};{clause}").CommandTimeout);
    }

    [Fact]
    public void DoesNotOverrideExplicitTimeouts()
    {
        var result = Normalize($"{Supabase};Timeout=5;Command Timeout=15");

        Assert.Equal(5, result.Timeout);
        Assert.Equal(15, result.CommandTimeout);
    }

    [Theory]
    [InlineData("SSL Mode=VerifyFull", SslMode.VerifyFull)]
    [InlineData("SslMode=VerifyCA", SslMode.VerifyCA)]
    [InlineData("SSL Mode=Prefer", SslMode.Prefer)]
    public void DoesNotOverrideAnExplicitSslMode(string clause, SslMode expected)
    {
        // Upgrading to VerifyFull (with a Root Certificate) must be possible purely from configuration.
        Assert.Equal(expected, Normalize($"{Supabase};{clause}").SslMode);
    }

    [Fact]
    public void LeavesALocalDatabaseUnencrypted()
    {
        // docker compose and a developer's Postgres have no server certificate; requiring TLS there
        // would break every local run.
        var result = Normalize("Host=localhost;Port=5432;Database=studyplatform;Username=tt;Password=123abc", isProduction: false);

        Assert.Equal(SslMode.Prefer, result.SslMode); // Npgsql's untouched default
        Assert.Equal(NpgsqlConnectionStringFactory.DefaultMaxPoolSize, result.MaxPoolSize);
    }

    [Fact]
    public void RefusesALoopbackDatabaseInProduction()
    {
        // The committed appsettings default points at localhost. A Production process that fell back
        // to it would come up "healthy" against the wrong database instead of failing the deployment.
        var ex = Assert.Throws<InvalidOperationException>(
            () => NpgsqlConnectionStringFactory.Normalize(
                "Host=localhost;Port=5432;Database=studyplatform;Username=tt;Password=123abc",
                isProduction: true));

        Assert.Contains("ConnectionStrings__DefaultConnection", ex.Message);
    }

    [Fact]
    public void AllowsAContainerHostnameInProduction()
    {
        // docker compose runs the API as Production against a `postgres` service — not loopback.
        var result = Normalize("Host=postgres;Port=5432;Database=studyplatform;Username=sp;Password=pw");

        Assert.Equal("postgres", result.Host);
    }

    [Fact]
    public void Create_WithoutAConnectionString_ExplainsWhichEnvironmentVariableToSet()
    {
        var configuration = new ConfigurationBuilder().Build();

        var ex = Assert.Throws<InvalidOperationException>(
            () => NpgsqlConnectionStringFactory.Create(configuration, isProduction: true));

        Assert.Contains("ConnectionStrings__DefaultConnection", ex.Message);
    }

    [Fact]
    public void Create_HonoursTheDatabaseSectionOverrides()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:DefaultConnection"] = Supabase,
                ["Database:MaxPoolSize"] = "8",
                ["Database:CommandTimeoutSeconds"] = "90",
                ["Database:ConnectTimeoutSeconds"] = "20",
            })
            .Build();

        var result = new NpgsqlConnectionStringBuilder(
            NpgsqlConnectionStringFactory.Create(configuration, isProduction: true));

        Assert.Equal(8, result.MaxPoolSize);
        Assert.Equal(90, result.CommandTimeout);
        Assert.Equal(20, result.Timeout);
    }

    [Fact]
    public void Create_RejectsAnUnparseableConnectionString()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:DefaultConnection"] = "Host=db;NotAKeyword=1",
            })
            .Build();

        Assert.Throws<InvalidOperationException>(
            () => NpgsqlConnectionStringFactory.Create(configuration, isProduction: true));
    }
}
