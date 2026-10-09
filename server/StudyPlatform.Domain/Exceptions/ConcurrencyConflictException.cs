namespace StudyPlatform.Domain.Exceptions;

/// <summary>
/// A save lost a race: the row changed (or was created) since it was read — two submits of the same
/// review, two tabs editing one thing. Raised by <c>IUnitOfWork.SaveChangesAsync</c> in place of the
/// persistence layer's own exceptions, so handlers and the API can react without referencing EF, and
/// answered as 409 Conflict: the client should re-read and decide, rather than see a 500.
/// </summary>
public sealed class ConcurrencyConflictException : Exception
{
    public ConcurrencyConflictException(Exception inner)
        : base("This item was changed by another request. Refresh and try again.", inner)
    {
    }
}
