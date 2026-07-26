using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using Xunit;

namespace StudyPlatform.Tests.AiJobs;

/// <summary>
/// The reaper itself runs against a DbContext, which this suite has no provider for, so what is
/// tested here is the predicate it selects on — the boundary between "slow" and "abandoned". Getting
/// it wrong either kills legitimate long generations or leaves users watching a dead spinner.
/// </summary>
public class StaleAiJobPredicateTests
{
    private static readonly TimeSpan StaleAfter = TimeSpan.FromMinutes(30);

    /// <summary>Mirrors StaleAiJobReaper.SweepAsync's Where clause.</summary>
    private static bool IsStale(AiJob job, DateTime now) =>
        (job.Status == AiJobStatus.Queued || job.Status == AiJobStatus.Running)
        && (job.StartedAt ?? job.CreatedAt) < now - StaleAfter;

    private static AiJob Job(string status, DateTime created, DateTime? started = null) => new()
    {
        AiJobId = Guid.NewGuid(),
        Status = status,
        CreatedAt = created,
        StartedAt = started,
    };

    [Fact]
    public void QueuedJobStrandedByARestart_IsReaped()
    {
        var now = DateTime.UtcNow;

        Assert.True(IsStale(Job(AiJobStatus.Queued, now.AddHours(-2)), now));
    }

    [Fact]
    public void RunningJobOnADeadReplica_IsReaped()
    {
        var now = DateTime.UtcNow;

        Assert.True(IsStale(Job(AiJobStatus.Running, now.AddHours(-3), now.AddHours(-2)), now));
    }

    [Fact]
    public void SlowButLiveGeneration_IsLeftAlone()
    {
        // A long document against a slow provider legitimately takes minutes. Failing it would be
        // worse than waiting.
        var now = DateTime.UtcNow;

        Assert.False(IsStale(Job(AiJobStatus.Running, now.AddMinutes(-40), now.AddMinutes(-5)), now));
    }

    [Fact]
    public void StartedAtTakesPrecedenceOverCreatedAt()
    {
        // A job that queued long ago but only started recently is live, not abandoned — otherwise a
        // backlog draining after an outage would be reaped the moment it began running.
        var now = DateTime.UtcNow;

        Assert.False(IsStale(Job(AiJobStatus.Running, now.AddHours(-5), now.AddMinutes(-2)), now));
    }

    [Theory]
    [InlineData(AiJobStatus.Succeeded)]
    [InlineData(AiJobStatus.Failed)]
    public void TerminalJobs_AreNeverTouched(string status)
    {
        var now = DateTime.UtcNow;

        Assert.False(IsStale(Job(status, now.AddDays(-30), now.AddDays(-30)), now));
    }
}

public class InstanceIdentityTests
{
    [Fact]
    public void EachInstanceGetsADistinctId()
    {
        // Two runs of the same process on the same host must not look like the same instance: the
        // whole point is to recognise work owned by a process that has since died.
        var a = new StudyPlatform.Infrastructure.Services.InstanceIdentity();
        var b = new StudyPlatform.Infrastructure.Services.InstanceIdentity();

        Assert.NotEqual(a.Id, b.Id);
    }

    [Fact]
    public void IdFitsTheColumn()
    {
        var identity = new StudyPlatform.Infrastructure.Services.InstanceIdentity();

        Assert.InRange(identity.Id.Length, 1, 64);
    }

    [Fact]
    public void IsStableWithinOneInstance()
    {
        IInstanceIdentity identity = new StudyPlatform.Infrastructure.Services.InstanceIdentity();

        Assert.Equal(identity.Id, identity.Id);
    }
}
