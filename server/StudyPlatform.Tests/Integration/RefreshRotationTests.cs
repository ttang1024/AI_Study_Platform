using MediatR;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using StudyPlatform.Application.Auth;
using StudyPlatform.Application.Auth.Commands;
using StudyPlatform.Application.Auth.DTOs;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using Xunit;

namespace StudyPlatform.Tests.Integration;

/// <summary>
/// Refresh-token rotation against the real table. The handler's unit tests mock the one thing that makes
/// rotation safe — the conditional UPDATE that lets exactly one request claim a token — so they cannot
/// show that two tabs refreshing at once, or a replayed stolen token, behave.
/// </summary>
[Collection(PostgresCollection.Name)]
public class RefreshRotationTests : IDisposable
{
    private readonly PostgresFixture _db;
    private readonly WebApplicationFactory<Program> _api;

    public RefreshRotationTests(PostgresFixture db)
    {
        _db = db;
        _api = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Testing");
            builder.UseSetting("ConnectionStrings:DefaultConnection", db.ConnectionString);
            builder.UseSetting("JwtSettings:SecretKey", new string('k', 64));
            builder.UseSetting("Redis:Enabled", "false");
            builder.UseSetting("S3:BucketName", "refresh-rotation");
        });
    }

    public void Dispose() => _api.Dispose();

    private async Task<(User User, string RefreshToken)> SignedInAsync(bool isActive = true)
    {
        var user = new User
        {
            UserId = Guid.NewGuid(), Email = $"{Guid.NewGuid():N}@example.com", FullName = "R", PasswordHash = "x",
            IsActive = isActive, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow,
        };
        await using (var seed = _db.NewContext())
        {
            seed.Users.Add(user);
            await seed.SaveChangesAsync();
        }
        using var scope = _api.Services.CreateScope();
        var tracked = await scope.ServiceProvider.GetRequiredService<StudyPlatform.Domain.Interfaces.IUserRepository>().GetByIdAsync(user.UserId);
        var session = await scope.ServiceProvider.GetRequiredService<IAuthSessionIssuer>().IssueAsync(tracked!);
        return (user, session.RefreshToken);
    }

    private async Task<Result<AuthResponse>> RefreshAsync(string token)
    {
        using var scope = _api.Services.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<IMediator>().Send(new RefreshTokenCommand(token));
    }

    [DockerFact]
    public async Task ConcurrentRefreshes_WithOneToken_ExactlyOneWins()
    {
        // Two tabs sharing the cookie refresh in the same instant. Both reading "not revoked" and both
        // minting would fork the session; the conditional UPDATE lets only one claim the token.
        var (_, token) = await SignedInAsync();

        var results = await Task.WhenAll(Enumerable.Range(0, 10).Select(_ => RefreshAsync(token)));

        Assert.Single(results, r => r.IsSuccess);
        Assert.All(results.Where(r => !r.IsSuccess), r => Assert.Equal("INVALID_REFRESH_TOKEN", r.ErrorCode));
    }

    [DockerFact]
    public async Task RotatedToken_ReplayedWithinTheGrace_IsRefused_ButTheSessionSurvives()
    {
        // The slower of two racing tabs: refused, but not treated as theft.
        var (_, token) = await SignedInAsync();
        var rotated = await RefreshAsync(token);

        var replay = await RefreshAsync(token);

        Assert.False(replay.IsSuccess);
        Assert.True((await RefreshAsync(rotated.Data!.RefreshToken)).IsSuccess);
    }

    [DockerFact]
    public async Task RotatedToken_ReplayedAfterTheGrace_EndsTheWholeSession()
    {
        // A copy of an old token turning up later means someone else holds it: both the thief and the
        // victim lose the session, and the victim signs in again.
        var (user, token) = await SignedInAsync();
        var rotated = await RefreshAsync(token);
        await using (var context = _db.NewContext())
            await context.RefreshTokens
                .Where(t => t.UserId == user.UserId && t.IsRevoked)
                .ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, DateTime.UtcNow - AuthTokenLifetimes.RotationReuseGrace - TimeSpan.FromSeconds(5)));

        var replay = await RefreshAsync(token);

        Assert.False(replay.IsSuccess);
        Assert.False((await RefreshAsync(rotated.Data!.RefreshToken)).IsSuccess);
    }

    [DockerFact]
    public async Task ExpiredRefreshToken_IsRefused()
    {
        var (user, token) = await SignedInAsync();
        await using (var context = _db.NewContext())
            await context.RefreshTokens.Where(t => t.UserId == user.UserId)
                .ExecuteUpdateAsync(s => s.SetProperty(t => t.ExpiresAt, DateTime.UtcNow.AddSeconds(-1)));

        Assert.Equal("INVALID_REFRESH_TOKEN", (await RefreshAsync(token)).ErrorCode);
    }

    [DockerFact]
    public async Task DeactivatedAccount_GetsNoNewAccessToken()
    {
        var (user, token) = await SignedInAsync();
        await using (var context = _db.NewContext())
            await context.Users.Where(u => u.UserId == user.UserId).ExecuteUpdateAsync(s => s.SetProperty(u => u.IsActive, false));

        Assert.Equal("ACCOUNT_DEACTIVATED", (await RefreshAsync(token)).ErrorCode);
    }

    [DockerFact]
    public async Task UnknownOrEmptyToken_IsRefused()
    {
        Assert.Equal("INVALID_REFRESH_TOKEN", (await RefreshAsync("not-a-token")).ErrorCode);
        Assert.Equal("INVALID_REFRESH_TOKEN", (await RefreshAsync("")).ErrorCode);
    }
}
