using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Notes.DTOs;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Notes.Commands;

public record CreateNoteCommand(
    Guid UserId,
    string Content,
    string? Title = null,
    Guid? DocumentId = null,
    Guid? VideoId = null) : IRequest<Result<NoteDto>>;

public class CreateNoteCommandHandler : IRequestHandler<CreateNoteCommand, Result<NoteDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    public CreateNoteCommandHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<NoteDto>> Handle(CreateNoteCommand request, CancellationToken cancellationToken)
    {
        var note = new Note
        {
            NoteId = Guid.NewGuid(),
            UserId = request.UserId,
            DocumentId = request.DocumentId,
            VideoId = request.VideoId,
            SourceType = request.VideoId.HasValue ? "video" : "document",
            Content = request.Content,
            Title = request.Title,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _unitOfWork.Notes.AddAsync(note, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<NoteDto>.Success(note.ToNoteDto(), "Note created successfully.");
    }
}

public record GetAllNotesPagedQuery(Guid UserId, int Page, int PageSize) : IRequest<Result<PaginatedList<NoteDto>>>;

public class GetAllNotesPagedQueryHandler : IRequestHandler<GetAllNotesPagedQuery, Result<PaginatedList<NoteDto>>>
{
    private readonly IUnitOfWork _unitOfWork;
    public GetAllNotesPagedQueryHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<PaginatedList<NoteDto>>> Handle(GetAllNotesPagedQuery request, CancellationToken cancellationToken)
    {
        var (notes, totalCount) = await _unitOfWork.Notes.GetPagedByUserIdAsync(request.UserId, request.Page, request.PageSize, cancellationToken);
        var dtos = notes.Select(n => n.ToNoteDto());
        return Result<PaginatedList<NoteDto>>.Success(new PaginatedList<NoteDto>(dtos, totalCount, request.Page, request.PageSize));
    }
}

public record UpdateNoteCommand(Guid NoteId, Guid UserId, string Content, string? Title = null) : IRequest<Result<NoteDto>>;

public class UpdateNoteCommandHandler : IRequestHandler<UpdateNoteCommand, Result<NoteDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    public UpdateNoteCommandHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<NoteDto>> Handle(UpdateNoteCommand request, CancellationToken cancellationToken)
    {
        var note = await _unitOfWork.Notes.FirstOrDefaultAsync(n => n.NoteId == request.NoteId && n.UserId == request.UserId, cancellationToken);
        if (note == null) return Result<NoteDto>.Failure("Note not found.", "NOTE_NOT_FOUND");

        note.Content = request.Content;
        note.Title = request.Title;
        note.UpdatedAt = DateTime.UtcNow;
        _unitOfWork.Notes.Update(note);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<NoteDto>.Success(note.ToNoteDto(), "Note updated successfully.");
    }
}

public record DeleteNoteCommand(Guid NoteId, Guid UserId) : IRequest<Result>;

public class DeleteNoteCommandHandler : IRequestHandler<DeleteNoteCommand, Result>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IEmbeddingIndex _embeddingIndex;

    public DeleteNoteCommandHandler(IUnitOfWork unitOfWork, IEmbeddingIndex embeddingIndex)
    {
        _unitOfWork = unitOfWork;
        _embeddingIndex = embeddingIndex;
    }

    public async Task<Result> Handle(DeleteNoteCommand request, CancellationToken cancellationToken)
    {
        var note = await _unitOfWork.Notes.FirstOrDefaultAsync(n => n.NoteId == request.NoteId && n.UserId == request.UserId, cancellationToken);
        if (note == null) return Result.Failure("Note not found.", "NOTE_NOT_FOUND");

        _unitOfWork.Notes.Remove(note);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        await _embeddingIndex.PruneOrphansAsync(request.UserId, cancellationToken);
        return Result.Success("Note deleted successfully.");
    }
}

public record BulkDeleteNotesCommand(IEnumerable<Guid> NoteIds, Guid UserId) : IRequest<Result>;

public class BulkDeleteNotesCommandHandler : IRequestHandler<BulkDeleteNotesCommand, Result>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IEmbeddingIndex _embeddingIndex;

    public BulkDeleteNotesCommandHandler(IUnitOfWork unitOfWork, IEmbeddingIndex embeddingIndex)
    {
        _unitOfWork = unitOfWork;
        _embeddingIndex = embeddingIndex;
    }

    public async Task<Result> Handle(BulkDeleteNotesCommand request, CancellationToken cancellationToken)
    {
        await _unitOfWork.Notes.DeleteByIdsAsync(request.NoteIds, request.UserId, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        await _embeddingIndex.PruneOrphansAsync(request.UserId, cancellationToken);
        return Result.Success("Notes deleted successfully.");
    }
}
