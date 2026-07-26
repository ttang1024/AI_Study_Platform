using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Documents.Queries;

/// <summary>
/// The document's plain text, with the version it belongs to.
///
/// <para><c>ContentVersion</c> travels with the text so the reader can tell that a citation
/// generated from an older version may no longer line up — the offsets index into a string that no
/// longer exists.</para>
/// </summary>
public record DocumentTextDto(Guid DocumentId, string? Text, int ContentVersion);

public record GetDocumentTextQuery(Guid UserId, Guid DocumentId) : IRequest<Result<DocumentTextDto>>;

public class GetDocumentTextQueryHandler : IRequestHandler<GetDocumentTextQuery, Result<DocumentTextDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IDocumentTextProvider _textProvider;

    public GetDocumentTextQueryHandler(IUnitOfWork unitOfWork, IDocumentTextProvider textProvider)
    {
        _unitOfWork = unitOfWork;
        _textProvider = textProvider;
    }

    public async Task<Result<DocumentTextDto>> Handle(
        GetDocumentTextQuery request, CancellationToken cancellationToken)
    {
        var document = await _unitOfWork.Documents.GetByIdAsync(request.DocumentId, cancellationToken);
        if (document == null || document.UserId != request.UserId)
            return Result<DocumentTextDto>.Failure("Document not found.", "DOCUMENT_NOT_FOUND");

        // Extracts and persists on first request; every later call, and every citation anchored
        // against it, sees the identical string.
        var text = await _textProvider.GetTextAsync(document, cancellationToken);

        return Result<DocumentTextDto>.Success(
            new DocumentTextDto(document.DocumentId, text, document.ContentVersion));
    }
}
