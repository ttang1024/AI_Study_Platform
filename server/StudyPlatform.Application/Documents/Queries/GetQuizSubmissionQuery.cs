using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Documents.Queries;

public record GetQuizSubmissionQuery(Guid DocumentId, Guid UserId) : IRequest<Result<QuizSubmissionDto?>>;

public class GetQuizSubmissionQueryHandler : IRequestHandler<GetQuizSubmissionQuery, Result<QuizSubmissionDto?>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetQuizSubmissionQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<QuizSubmissionDto?>> Handle(GetQuizSubmissionQuery request, CancellationToken cancellationToken)
    {
        var submission = await _unitOfWork.QuizSubmissions.GetByDocumentAndUserAsync(
            request.DocumentId, request.UserId, cancellationToken);

        if (submission == null)
            return Result<QuizSubmissionDto?>.Success(null, "No submission found.");

        var dto = submission.ToQuizSubmissionDto();

        return Result<QuizSubmissionDto?>.Success(dto, "Submission retrieved.");
    }
}

public record GetAllQuizSubmissionsPagedQuery(Guid UserId, int Page, int PageSize) : IRequest<Result<PaginatedList<QuizSubmissionDto>>>;

public record GetQuizSubmissionCoverageQuery(Guid UserId) : IRequest<Result<QuizSubmissionCoverageDto>>;

public record GetPendingQuizMaterialsQuery(Guid UserId) : IRequest<Result<IEnumerable<PendingMaterialDto>>>;

public record GetGeneratedQuizMaterialsQuery(Guid UserId) : IRequest<Result<IEnumerable<PendingMaterialDto>>>;

public class GetAllQuizSubmissionsPagedQueryHandler : IRequestHandler<GetAllQuizSubmissionsPagedQuery, Result<PaginatedList<QuizSubmissionDto>>>
{
    private readonly IUnitOfWork _unitOfWork;
    public GetAllQuizSubmissionsPagedQueryHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<PaginatedList<QuizSubmissionDto>>> Handle(GetAllQuizSubmissionsPagedQuery request, CancellationToken cancellationToken)
    {
        var (submissions, totalCount) = await _unitOfWork.QuizSubmissions.GetPagedByUserAsync(request.UserId, request.Page, request.PageSize, cancellationToken);
        var dtos = submissions.Select(s => s.ToQuizSubmissionDto());
        return Result<PaginatedList<QuizSubmissionDto>>.Success(new PaginatedList<QuizSubmissionDto>(dtos, totalCount, request.Page, request.PageSize));
    }
}

public class GetQuizSubmissionCoverageQueryHandler : IRequestHandler<GetQuizSubmissionCoverageQuery, Result<QuizSubmissionCoverageDto>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetQuizSubmissionCoverageQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<QuizSubmissionCoverageDto>> Handle(GetQuizSubmissionCoverageQuery request, CancellationToken cancellationToken)
    {
        var (documentIds, videoIds) = await _unitOfWork.QuizSubmissions.GetCoverageByUserAsync(request.UserId, cancellationToken);
        return Result<QuizSubmissionCoverageDto>.Success(new QuizSubmissionCoverageDto(documentIds, videoIds));
    }
}

public class GetPendingQuizMaterialsQueryHandler : IRequestHandler<GetPendingQuizMaterialsQuery, Result<IEnumerable<PendingMaterialDto>>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IStudyMaterialLookup _materials;

    public GetPendingQuizMaterialsQueryHandler(IUnitOfWork unitOfWork, IStudyMaterialLookup materials)
    {
        _unitOfWork = unitOfWork;
        _materials = materials;
    }

    public async Task<Result<IEnumerable<PendingMaterialDto>>> Handle(GetPendingQuizMaterialsQuery request, CancellationToken cancellationToken)
    {
        var (documentIdsWithSubmissions, videoIdsWithSubmissions) = await _unitOfWork.QuizSubmissions.GetCoverageByUserAsync(request.UserId, cancellationToken);
        var pending = await _materials.ListUncoveredAsync(
            request.UserId, documentIdsWithSubmissions, videoIdsWithSubmissions, cancellationToken);
        return Result<IEnumerable<PendingMaterialDto>>.Success(pending);
    }
}

public class GetGeneratedQuizMaterialsQueryHandler : IRequestHandler<GetGeneratedQuizMaterialsQuery, Result<IEnumerable<PendingMaterialDto>>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IStudyMaterialLookup _materials;

    public GetGeneratedQuizMaterialsQueryHandler(IUnitOfWork unitOfWork, IStudyMaterialLookup materials)
    {
        _unitOfWork = unitOfWork;
        _materials = materials;
    }

    public async Task<Result<IEnumerable<PendingMaterialDto>>> Handle(GetGeneratedQuizMaterialsQuery request, CancellationToken cancellationToken)
    {
        var generatedQuizzes = await _unitOfWork.Quizzes.FindAsNoTrackingAsync(q => q.UserId == request.UserId, cancellationToken);
        var generatedDocumentIds = generatedQuizzes
            .Where(q => q.DocumentId.HasValue && q.SourceType != "video")
            .Select(q => q.DocumentId!.Value)
            .Distinct()
            .ToHashSet();
        var generatedVideoIds = generatedQuizzes
            .Where(q => q.VideoId.HasValue || q.SourceType == "video")
            .Select(q => q.VideoId)
            .Where(id => id.HasValue)
            .Select(id => id!.Value)
            .Distinct()
            .ToHashSet();

        // Generated but not yet taken: a submission means the material has moved on from this list.
        var (documentIdsWithSubmissions, videoIdsWithSubmissions) = await _unitOfWork.QuizSubmissions.GetCoverageByUserAsync(request.UserId, cancellationToken);
        generatedDocumentIds.ExceptWith(documentIdsWithSubmissions);
        generatedVideoIds.ExceptWith(videoIdsWithSubmissions);

        var generated = await _materials.ListSelectedAsync(
            request.UserId, generatedDocumentIds, generatedVideoIds, cancellationToken);
        return Result<IEnumerable<PendingMaterialDto>>.Success(generated);
    }
}
