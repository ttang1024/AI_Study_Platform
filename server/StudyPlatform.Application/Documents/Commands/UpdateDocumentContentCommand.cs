using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Documents.Commands;

// Persist user edits to AI-generated content (summary / mind map). Patch semantics:
// a null field is left unchanged.
public record UpdateDocumentContentCommand(Guid DocumentId, Guid UserId, string? Summary, string? MindMapText)
    : IRequest<Result<DocumentDto>>;

public class UpdateDocumentContentCommandHandler : IRequestHandler<UpdateDocumentContentCommand, Result<DocumentDto>>
{
    private readonly IUnitOfWork _unitOfWork;

    public UpdateDocumentContentCommandHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<DocumentDto>> Handle(UpdateDocumentContentCommand request, CancellationToken cancellationToken)
    {
        var document = await _unitOfWork.Documents.GetByIdAsync(request.DocumentId, cancellationToken);
        if (document == null || document.UserId != request.UserId)
            return Result<DocumentDto>.Failure("Document not found.", "DOCUMENT_NOT_FOUND");

        if (request.Summary != null)
            document.Summary = request.Summary;
        if (request.MindMapText != null)
            document.MindMapText = request.MindMapText;
        document.UpdatedAt = DateTime.UtcNow;

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<DocumentDto>.Success(document.ToDocumentDto());
    }
}
