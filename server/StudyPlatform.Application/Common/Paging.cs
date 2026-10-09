using FluentValidation;
using StudyPlatform.Application.Admin.Queries;
using StudyPlatform.Application.Documents.Queries;
using StudyPlatform.Application.Flashcards.Commands;
using StudyPlatform.Application.Notes.Commands;
using StudyPlatform.Application.Search.Queries;
using StudyPlatform.Application.Videos.Queries;

namespace StudyPlatform.Application.Common;

/// <summary>A query that pages through a list by client-supplied <see cref="Page"/> and <see cref="PageSize"/>.</summary>
public interface IPagedRequest
{
    int Page { get; }

    int PageSize { get; }
}

/// <summary>
/// Bounds on client-supplied paging. Without them, <c>pageSize=1000000</c> loads a user's whole table
/// into memory in one request, and <c>page=0</c> becomes a negative OFFSET (a 500 from Postgres).
/// Out-of-range values are rejected (400 via ValidationBehavior), not silently clamped, so a caller
/// asking for more than it can get finds out rather than receiving a quietly truncated list.
/// </summary>
public abstract class PagedRequestValidator<T> : AbstractValidator<T> where T : IPagedRequest
{
    /// <summary>Largest page any current client asks for (the mobile flashcard list).</summary>
    public const int DefaultMaxPageSize = 200;

    protected PagedRequestValidator(int maxPageSize = DefaultMaxPageSize)
    {
        RuleFor(x => x.Page).GreaterThanOrEqualTo(1);
        RuleFor(x => x.PageSize).InclusiveBetween(1, maxPageSize);
    }
}

public sealed class GetAllFlashcardsPagedQueryValidator : PagedRequestValidator<GetAllFlashcardsPagedQuery>;
public sealed class GetAllNotesPagedQueryValidator : PagedRequestValidator<GetAllNotesPagedQuery>;
public sealed class GetAllQuizSubmissionsPagedQueryValidator : PagedRequestValidator<GetAllQuizSubmissionsPagedQuery>;
public sealed class GetAllDocumentsQueryValidator : PagedRequestValidator<GetAllDocumentsQuery>;
public sealed class GetVideosQueryValidator : PagedRequestValidator<GetVideosQuery>;
public sealed class GlobalSearchQueryValidator : PagedRequestValidator<GlobalSearchQuery>;
public sealed class ListUsersQueryValidator : PagedRequestValidator<ListUsersQuery>;
public sealed class ListFeedbackQueryValidator : PagedRequestValidator<ListFeedbackQuery>;

/// <summary>The lightweight video list is fetched whole (500 per page) just to label other content.</summary>
public sealed class GetVideosLiteQueryValidator() : PagedRequestValidator<GetVideosLiteQuery>(maxPageSize: 500);
