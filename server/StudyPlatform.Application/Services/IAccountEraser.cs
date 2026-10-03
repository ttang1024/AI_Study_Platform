namespace StudyPlatform.Application.Services;

/// <summary>
/// Irreversibly removes a user and everything belonging to them.
///
/// <para>Separate from the command that requests deletion because the two happen days apart: the
/// request revokes access immediately and starts a grace period, and only the worker at the end of
/// it calls this.</para>
/// </summary>
public interface IAccountEraser
{
    /// <summary>
    /// Deletes the user's rows and stored files. Returns false if the user no longer exists, which
    /// makes the worker's retry after a partial failure safe to run again.
    /// </summary>
    Task<bool> EraseAsync(Guid userId, CancellationToken cancellationToken = default);
}
