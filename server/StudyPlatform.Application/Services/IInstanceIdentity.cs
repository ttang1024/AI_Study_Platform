namespace StudyPlatform.Application.Services;

/// <summary>
/// Identifies this API process, so work can record which replica owns it.
/// </summary>
public interface IInstanceIdentity
{
    /// <summary>
    /// Unique per process *run*. Deliberately not stable across restarts: its purpose is to make
    /// work owned by a process that has since died recognisable as orphaned, and a stable id would
    /// let a restarted instance look like the same one and adopt jobs whose in-memory credentials
    /// died with the previous process.
    /// </summary>
    string Id { get; }
}
