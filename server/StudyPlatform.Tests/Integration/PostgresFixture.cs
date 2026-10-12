using Microsoft.EntityFrameworkCore;
using StudyPlatform.Infrastructure.Data;
using Testcontainers.PostgreSql;
using Xunit;

namespace StudyPlatform.Tests.Integration;

/// <summary>
/// A throwaway Postgres for the integration tests: the same pgvector image the app requires, with every
/// migration applied from empty — which is also the test that the migrations apply at all.
/// </summary>
public sealed class PostgresFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _container = new PostgreSqlBuilder("pgvector/pgvector:pg17").Build();

    public string ConnectionString => _container.GetConnectionString();

    public AppDbContext NewContext() => new(new DbContextOptionsBuilder<AppDbContext>()
        .UseNpgsql(ConnectionString, o => o.UseVector())
        .Options);

    public async Task InitializeAsync()
    {
        if (!DockerFactAttribute.DockerAvailable)
            return;
        await _container.StartAsync();
        await using var db = NewContext();
        await db.Database.MigrateAsync();
    }

    public Task DisposeAsync() => DockerFactAttribute.DockerAvailable ? _container.DisposeAsync().AsTask() : Task.CompletedTask;
}

[CollectionDefinition(Name)]
public sealed class PostgresCollection : ICollectionFixture<PostgresFixture>
{
    public const string Name = "Postgres";
}

/// <summary>
/// A test that needs Docker. Skipped, not failed, where there is none, so <c>dotnet test</c> keeps
/// working with no external services.
/// </summary>
public sealed class DockerFactAttribute : FactAttribute
{
    public static readonly bool DockerAvailable =
        !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("DOCKER_HOST"))
        || File.Exists("/var/run/docker.sock")
        || File.Exists(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".docker/run/docker.sock"));

    public DockerFactAttribute()
    {
        if (!DockerAvailable)
            Skip = "Docker is not available; integration tests need it to start Postgres.";
    }
}
