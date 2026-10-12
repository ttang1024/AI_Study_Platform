using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Application.Auth;

/// <summary>The password comparison every password sign-in path shares.</summary>
public static class PasswordCheck
{
    private static string? _dummyHash;

    /// <summary>
    /// True when <paramref name="user"/> exists and <paramref name="password"/> matches its hash. An
    /// unknown account still spends one hash verification, so response time does not reveal whether the
    /// email is registered.
    /// </summary>
    public static bool Matches(IPasswordHasher hasher, User? user, string password)
    {
        if (user is null)
        {
            hasher.Verify(password, _dummyHash ??= hasher.Hash(Guid.NewGuid().ToString()));
            return false;
        }

        return hasher.Verify(password, user.PasswordHash);
    }
}

/// <summary>The reply for a sign-in refused by <see cref="ILoginThrottle"/>.</summary>
public static class LoginThrottleMessages
{
    public const string ErrorCode = "TOO_MANY_ATTEMPTS";
    public const string LockedOut = "Too many failed sign-in attempts. Please wait 15 minutes and try again.";
}
