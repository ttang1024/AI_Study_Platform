using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Glossary.Commands;

public record GetAllGlossaryTermsQuery(Guid UserId) : IRequest<Result<IEnumerable<GlossaryTermDto>>>;

public class GetAllGlossaryTermsQueryHandler : IRequestHandler<GetAllGlossaryTermsQuery, Result<IEnumerable<GlossaryTermDto>>>
{
    private readonly IUnitOfWork _unitOfWork;
    public GetAllGlossaryTermsQueryHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<IEnumerable<GlossaryTermDto>>> Handle(GetAllGlossaryTermsQuery request, CancellationToken cancellationToken)
    {
        var terms = await _unitOfWork.GlossaryTerms.GetByUserWithSourcesAsync(request.UserId, cancellationToken);
        var dtos = terms.Select(t =>
        {
            var isVideo = t.YouTubeVideoId.HasValue;
            var document = t.Document;
            var video = t.YouTubeVideo;
            var sourceKind = isVideo
                ? "video"
                : document?.OriginalUrl != null
                    ? "article"
                    : IsAudioContent(document?.ContentType, document?.FileName)
                        ? "audio"
                        : "document";

            return new GlossaryTermDto(
                t.GlossaryTermId,
                t.DocumentId,
                t.Term,
                t.Definition,
                t.CreatedAt,
                t.YouTubeVideoId,
                video?.CourseId ?? document?.CourseId,
                video?.Title ?? document?.FileName,
                sourceKind);
        }).ToList();

        return Result<IEnumerable<GlossaryTermDto>>.Success(dtos);
    }

    private static bool IsAudioContent(string? contentType, string? fileName)
    {
        if (contentType == "audio/podcast" || contentType?.StartsWith("audio/") == true)
            return true;

        if (fileName == null)
            return false;

        var lower = fileName.ToLowerInvariant();
        return lower.EndsWith(".mp3")
            || lower.EndsWith(".m4a")
            || lower.EndsWith(".wav")
            || lower.EndsWith(".ogg")
            || lower.EndsWith(".aac")
            || lower.EndsWith(".flac")
            || lower.EndsWith(".webm");
    }
}

public record UpdateGlossaryTermCommand(Guid UserId, Guid TermId, string Term, string Definition)
    : IRequest<Result<GlossaryTermDto>>;

public class UpdateGlossaryTermCommandHandler : IRequestHandler<UpdateGlossaryTermCommand, Result<GlossaryTermDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    public UpdateGlossaryTermCommandHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<GlossaryTermDto>> Handle(UpdateGlossaryTermCommand request, CancellationToken cancellationToken)
    {
        var term = await _unitOfWork.GlossaryTerms.GetByIdAsync(request.TermId, cancellationToken);
        if (term == null || term.UserId != request.UserId)
            return Result<GlossaryTermDto>.Failure("Glossary term not found.", "NOT_FOUND");

        term.Term = request.Term.Trim();
        term.Definition = request.Definition.Trim();
        _unitOfWork.GlossaryTerms.Update(term);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var dto = term.ToGlossaryTermDto();
        return Result<GlossaryTermDto>.Success(dto, "Term updated.");
    }
}

public record DeleteGlossaryTermCommand(Guid UserId, Guid TermId) : IRequest<Result<bool>>;

public class DeleteGlossaryTermCommandHandler : IRequestHandler<DeleteGlossaryTermCommand, Result<bool>>
{
    private readonly IUnitOfWork _unitOfWork;
    public DeleteGlossaryTermCommandHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<bool>> Handle(DeleteGlossaryTermCommand request, CancellationToken cancellationToken)
    {
        var term = await _unitOfWork.GlossaryTerms.GetByIdAsync(request.TermId, cancellationToken);
        if (term == null || term.UserId != request.UserId)
            return Result<bool>.Failure("Glossary term not found.", "NOT_FOUND");

        _unitOfWork.GlossaryTerms.Remove(term);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return Result<bool>.Success(true, "Term deleted.");
    }
}
