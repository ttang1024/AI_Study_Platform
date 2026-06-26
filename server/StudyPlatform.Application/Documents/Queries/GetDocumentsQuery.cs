using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Application.Notes.DTOs;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.Settings;
using StudyPlatform.Domain.Interfaces;
using Microsoft.Extensions.Options;

namespace StudyPlatform.Application.Documents.Queries;

public record GetAllDocumentsQuery(Guid UserId, int Page, int PageSize, Guid? CourseId) : IRequest<Result<PaginatedList<DocumentDto>>>;

public class GetAllDocumentsQueryHandler : IRequestHandler<GetAllDocumentsQuery, Result<PaginatedList<DocumentDto>>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetAllDocumentsQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<PaginatedList<DocumentDto>>> Handle(GetAllDocumentsQuery request, CancellationToken cancellationToken)
    {
        var (documents, totalCount) = await _unitOfWork.Documents.GetAllByUserIdAsync(
            request.UserId, request.Page, request.PageSize, request.CourseId, cancellationToken);

        var dtos = documents.Select(d => d.ToDocumentDto());

        return Result<PaginatedList<DocumentDto>>.Success(
            new PaginatedList<DocumentDto>(dtos, totalCount, request.Page, request.PageSize));
    }
}

public record GetDocumentsByCourseQuery(Guid CourseId, Guid UserId) : IRequest<Result<IEnumerable<DocumentDto>>>;

public class GetDocumentsByCourseQueryHandler : IRequestHandler<GetDocumentsByCourseQuery, Result<IEnumerable<DocumentDto>>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetDocumentsByCourseQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<IEnumerable<DocumentDto>>> Handle(GetDocumentsByCourseQuery request, CancellationToken cancellationToken)
    {
        var course = await _unitOfWork.Courses.GetByIdAsync(request.CourseId, cancellationToken);
        if (course == null)
            return Result<IEnumerable<DocumentDto>>.Failure("Course not found.", "COURSE_NOT_FOUND");

        IEnumerable<Domain.Entities.Document> documents;
        if (course.UserId == request.UserId)
        {
            documents = await _unitOfWork.Documents.GetByCourseIdAsync(request.CourseId, request.UserId, cancellationToken);
        }
        else
        {
            var hasGroupAccess = await HasGroupAccessAsync(request.UserId, request.CourseId, cancellationToken);
            if (!hasGroupAccess)
                return Result<IEnumerable<DocumentDto>>.Failure("Course not found.", "COURSE_NOT_FOUND");
            documents = await _unitOfWork.Documents.GetByCourseIdAsync(request.CourseId, cancellationToken);
        }

        var dtos = documents.Select(d => d.ToDocumentDto());

        return Result<IEnumerable<DocumentDto>>.Success(dtos);
    }

    private async Task<bool> HasGroupAccessAsync(Guid userId, Guid courseId, CancellationToken ct)
    {
        var shared = await _unitOfWork.StudyGroupSharedCourses.FindAsync(sc => sc.CourseId == courseId, ct);
        var groupIds = shared.Select(sc => sc.GroupId).ToList();
        return groupIds.Count > 0 && await _unitOfWork.StudyGroupMembers.ExistsAsync(
            m => groupIds.Contains(m.GroupId) && m.UserId == userId, ct);
    }
}

public record GetDocumentByIdQuery(Guid DocumentId, Guid UserId) : IRequest<Result<DocumentDto>>;

public class GetDocumentByIdQueryHandler : IRequestHandler<GetDocumentByIdQuery, Result<DocumentDto>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetDocumentByIdQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<DocumentDto>> Handle(GetDocumentByIdQuery request, CancellationToken cancellationToken)
    {
        var document = await _unitOfWork.Documents.GetByIdAsync(request.DocumentId, cancellationToken);
        if (document == null)
            return Result<DocumentDto>.Failure("Document not found.", "DOCUMENT_NOT_FOUND");

        if (document.UserId != request.UserId)
        {
            var shared = await _unitOfWork.StudyGroupSharedCourses.FindAsync(sc => sc.CourseId == document.CourseId, cancellationToken);
            var groupIds = shared.Select(sc => sc.GroupId).ToList();
            var hasGroupAccess = groupIds.Count > 0 && await _unitOfWork.StudyGroupMembers.ExistsAsync(
                m => groupIds.Contains(m.GroupId) && m.UserId == request.UserId, cancellationToken);
            if (!hasGroupAccess)
                return Result<DocumentDto>.Failure("Document not found.", "DOCUMENT_NOT_FOUND");
        }

        return Result<DocumentDto>.Success(document.ToDocumentDto());
    }
}

public record GetDocumentNotesQuery(Guid DocumentId, Guid UserId) : IRequest<Result<IEnumerable<NoteDto>>>;

public class GetDocumentNotesQueryHandler : IRequestHandler<GetDocumentNotesQuery, Result<IEnumerable<NoteDto>>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetDocumentNotesQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<IEnumerable<NoteDto>>> Handle(GetDocumentNotesQuery request, CancellationToken cancellationToken)
    {
        var document = await _unitOfWork.Documents.GetByIdAsync(request.DocumentId, cancellationToken);
        if (document == null)
            return Result<IEnumerable<NoteDto>>.Failure("Document not found.", "DOCUMENT_NOT_FOUND");

        if (document.UserId != request.UserId && !await HasGroupAccessAsync(request.UserId, document.CourseId, cancellationToken))
            return Result<IEnumerable<NoteDto>>.Failure("Document not found.", "DOCUMENT_NOT_FOUND");

        var notes = await _unitOfWork.Notes.GetByDocumentIdAsync(request.DocumentId, cancellationToken);
        var dtos = notes.Select(n => n.ToNoteDto());

        return Result<IEnumerable<NoteDto>>.Success(dtos);
    }

    private async Task<bool> HasGroupAccessAsync(Guid userId, Guid courseId, CancellationToken ct)
    {
        var shared = await _unitOfWork.StudyGroupSharedCourses.FindAsync(sc => sc.CourseId == courseId, ct);
        var groupIds = shared.Select(sc => sc.GroupId).ToList();
        return groupIds.Count > 0 && await _unitOfWork.StudyGroupMembers.ExistsAsync(
            m => groupIds.Contains(m.GroupId) && m.UserId == userId, ct);
    }
}

public record GetAIChatHistoryQuery(Guid DocumentId, Guid UserId) : IRequest<Result<IEnumerable<ChatMessageDto>>>;

public class GetAIChatHistoryQueryHandler : IRequestHandler<GetAIChatHistoryQuery, Result<IEnumerable<ChatMessageDto>>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IBlobStorageService _blobStorageService;

    public GetAIChatHistoryQueryHandler(IUnitOfWork unitOfWork, IBlobStorageService blobStorageService)
    {
        _unitOfWork = unitOfWork;
        _blobStorageService = blobStorageService;
    }

    public async Task<Result<IEnumerable<ChatMessageDto>>> Handle(GetAIChatHistoryQuery request, CancellationToken cancellationToken)
    {
        var document = await _unitOfWork.Documents.GetByIdAsync(request.DocumentId, cancellationToken);
        if (document == null)
            return Result<IEnumerable<ChatMessageDto>>.Failure("Document not found.", "DOCUMENT_NOT_FOUND");

        if (document.UserId != request.UserId && !await HasGroupAccessAsync(request.UserId, document.CourseId, cancellationToken))
            return Result<IEnumerable<ChatMessageDto>>.Failure("Document not found.", "DOCUMENT_NOT_FOUND");

        var chatUserId = document.UserId == request.UserId ? request.UserId : document.UserId;
        var messages = await _unitOfWork.ChatMessages.GetByDocumentIdAsync(request.DocumentId, chatUserId, cancellationToken);
        var dtos = new List<ChatMessageDto>();
        foreach (var m in messages)
            dtos.Add(await m.ToDtoAsync(_blobStorageService, cancellationToken));

        return Result<IEnumerable<ChatMessageDto>>.Success(dtos);
    }

    private async Task<bool> HasGroupAccessAsync(Guid userId, Guid courseId, CancellationToken ct)
    {
        var shared = await _unitOfWork.StudyGroupSharedCourses.FindAsync(sc => sc.CourseId == courseId, ct);
        var groupIds = shared.Select(sc => sc.GroupId).ToList();
        return groupIds.Count > 0 && await _unitOfWork.StudyGroupMembers.ExistsAsync(
            m => groupIds.Contains(m.GroupId) && m.UserId == userId, ct);
    }
}

public record GetDocumentQuizzesQuery(Guid DocumentId, Guid UserId, string? Difficulty = null) : IRequest<Result<IEnumerable<QuizDto>>>;

public class GetDocumentQuizzesQueryHandler : IRequestHandler<GetDocumentQuizzesQuery, Result<IEnumerable<QuizDto>>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetDocumentQuizzesQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<IEnumerable<QuizDto>>> Handle(GetDocumentQuizzesQuery request, CancellationToken cancellationToken)
    {
        var document = await _unitOfWork.Documents.GetByIdAsync(request.DocumentId, cancellationToken);
        if (document == null)
            return Result<IEnumerable<QuizDto>>.Failure("Document not found.", "DOCUMENT_NOT_FOUND");

        if (document.UserId != request.UserId && !await HasGroupAccessAsync(request.UserId, document.CourseId, cancellationToken))
            return Result<IEnumerable<QuizDto>>.Failure("Document not found.", "DOCUMENT_NOT_FOUND");

        var quizzes = string.IsNullOrWhiteSpace(request.Difficulty)
            ? await _unitOfWork.Quizzes.GetByDocumentIdAsync(request.DocumentId, cancellationToken)
            : await _unitOfWork.Quizzes.GetByDocumentIdAndDifficultyAsync(request.DocumentId, QuizDifficulty.Normalize(request.Difficulty), cancellationToken);
        var dtos = quizzes.Select(q => q.ToQuizDto());

        return Result<IEnumerable<QuizDto>>.Success(dtos);
    }

    private async Task<bool> HasGroupAccessAsync(Guid userId, Guid courseId, CancellationToken ct)
    {
        var shared = await _unitOfWork.StudyGroupSharedCourses.FindAsync(sc => sc.CourseId == courseId, ct);
        var groupIds = shared.Select(sc => sc.GroupId).ToList();
        return groupIds.Count > 0 && await _unitOfWork.StudyGroupMembers.ExistsAsync(
            m => groupIds.Contains(m.GroupId) && m.UserId == userId, ct);
    }
}

public record GetDocumentDownloadUrlQuery(Guid DocumentId, Guid UserId) : IRequest<Result<string>>;

public class GetDocumentDownloadUrlQueryHandler : IRequestHandler<GetDocumentDownloadUrlQuery, Result<string>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IBlobStorageService _blobStorageService;
    private readonly IAppCache _cache;
    private readonly CacheOptions _cacheOptions;

    public GetDocumentDownloadUrlQueryHandler(
        IUnitOfWork unitOfWork,
        IBlobStorageService blobStorageService,
        IAppCache cache,
        IOptions<CacheOptions> cacheOptions)
    {
        _unitOfWork = unitOfWork;
        _blobStorageService = blobStorageService;
        _cache = cache;
        _cacheOptions = cacheOptions.Value;
    }

    public async Task<Result<string>> Handle(GetDocumentDownloadUrlQuery request, CancellationToken cancellationToken)
    {
        var document = await _unitOfWork.Documents.GetByIdAsync(request.DocumentId, cancellationToken);
        if (document == null || document.UserId != request.UserId)
            return Result<string>.Failure("Document not found.", "DOCUMENT_NOT_FOUND");

        var cacheKey = $"documents:sas:{request.DocumentId}";
        var sasUrl = await _cache.GetOrCreateAsync(
            cacheKey,
            ct => _blobStorageService.GetSasUrlAsync(document.BlobUrl, expiryMinutes: 60, ct),
            TimeSpan.FromSeconds(_cacheOptions.SasUrlSeconds),
            cancellationToken);

        return Result<string>.Success(sasUrl);
    }
}

public record GetDocumentFlashcardsQuery(Guid DocumentId, Guid UserId) : IRequest<Result<IEnumerable<FlashcardDto>>>;

public class GetDocumentFlashcardsQueryHandler : IRequestHandler<GetDocumentFlashcardsQuery, Result<IEnumerable<FlashcardDto>>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetDocumentFlashcardsQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<IEnumerable<FlashcardDto>>> Handle(GetDocumentFlashcardsQuery request, CancellationToken cancellationToken)
    {
        var document = await _unitOfWork.Documents.GetByIdAsync(request.DocumentId, cancellationToken);
        if (document == null)
            return Result<IEnumerable<FlashcardDto>>.Failure("Document not found.", "DOCUMENT_NOT_FOUND");

        if (document.UserId != request.UserId && !await HasGroupAccessAsync(request.UserId, document.CourseId, cancellationToken))
            return Result<IEnumerable<FlashcardDto>>.Failure("Document not found.", "DOCUMENT_NOT_FOUND");

        var flashcards = await _unitOfWork.Flashcards.GetByDocumentIdAsync(request.DocumentId, cancellationToken);
        var dtos = flashcards.Select(f => f.ToFlashcardDto());

        return Result<IEnumerable<FlashcardDto>>.Success(dtos);
    }

    private async Task<bool> HasGroupAccessAsync(Guid userId, Guid courseId, CancellationToken ct)
    {
        var shared = await _unitOfWork.StudyGroupSharedCourses.FindAsync(sc => sc.CourseId == courseId, ct);
        var groupIds = shared.Select(sc => sc.GroupId).ToList();
        return groupIds.Count > 0 && await _unitOfWork.StudyGroupMembers.ExistsAsync(
            m => groupIds.Contains(m.GroupId) && m.UserId == userId, ct);
    }
}
