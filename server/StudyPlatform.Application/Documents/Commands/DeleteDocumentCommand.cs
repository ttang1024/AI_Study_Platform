using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Documents.Commands;

public record DeleteDocumentCommand(Guid DocumentId, Guid UserId) : IRequest<Result>;

public class DeleteDocumentCommandHandler : IRequestHandler<DeleteDocumentCommand, Result>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IDocumentRepository _documents;
    private readonly ILibraryTagRepository _libraryTags;
    private readonly IStoredFileCleanup _storedFiles;
    private readonly IEmbeddingIndex _embeddingIndex;

    public DeleteDocumentCommandHandler(
        IUnitOfWork unitOfWork,
        IDocumentRepository documents,
        ILibraryTagRepository libraryTags,
        IStoredFileCleanup storedFiles,
        IEmbeddingIndex embeddingIndex)
    {
        _unitOfWork = unitOfWork;
        _documents = documents;
        _libraryTags = libraryTags;
        _storedFiles = storedFiles;
        _embeddingIndex = embeddingIndex;
    }

    public async Task<Result> Handle(DeleteDocumentCommand request, CancellationToken cancellationToken)
    {
        var document = await _documents.GetOwnedAsync(request.DocumentId, request.UserId, cancellationToken);
        if (document == null)
            return Result.Failure("Document not found.", "DOCUMENT_NOT_FOUND");

        _documents.Remove(document);

        // The tag join is polymorphic, so no foreign key reaches it and no cascade fires. Pruned
        // here or the assignment outlives the document and inflates every collection's item count.
        await _libraryTags.RemoveAssignmentsForItemAsync(
            "document", document.DocumentId, cancellationToken);

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        // Only now that the row is gone (see IStoredFileCleanup).
        await _storedFiles.DeleteAsync([document.BlobUrl], CancellationToken.None);

        // After the save, so the cascade has taken the document's flashcards and glossary terms with it
        // and their chunks look orphaned too.
        await _embeddingIndex.PruneOrphansAsync(request.UserId, cancellationToken);

        return Result.Success("Document deleted successfully.");
    }
}
