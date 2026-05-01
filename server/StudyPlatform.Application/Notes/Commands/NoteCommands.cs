using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Notes.DTOs;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Notes.Commands;

public record CreateNoteCommand(
    Guid UserId,
    string Content,
    string? Title = null,
    Guid? DocumentId = null,
    Guid? YouTubeVideoId = null) : IRequest<Result<NoteDto>>;

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
            YouTubeVideoId = request.YouTubeVideoId,
            SourceType = request.YouTubeVideoId.HasValue ? "video" : "document",
            Content = request.Content,
            Title = request.Title,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _unitOfWork.Notes.AddAsync(note, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<NoteDto>.Success(ToDto(note), "Note created successfully.");
    }

    internal static NoteDto ToDto(Note n) => new(n.NoteId, n.UserId, n.DocumentId, n.YouTubeVideoId, n.SourceType, n.Content, n.Title, n.CreatedAt, n.UpdatedAt,
        Document: n.Document?.FileName,
        Video: n.YouTubeVideo?.Title);
}

public record GetAllNotesQuery(Guid UserId) : IRequest<Result<IEnumerable<NoteDto>>>;

public record GetAllNotesPagedQuery(Guid UserId, int Page, int PageSize) : IRequest<Result<PaginatedList<NoteDto>>>;

public class GetAllNotesPagedQueryHandler : IRequestHandler<GetAllNotesPagedQuery, Result<PaginatedList<NoteDto>>>
{
    private readonly IUnitOfWork _unitOfWork;
    public GetAllNotesPagedQueryHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<PaginatedList<NoteDto>>> Handle(GetAllNotesPagedQuery request, CancellationToken cancellationToken)
    {
        var (notes, totalCount) = await _unitOfWork.Notes.GetPagedByUserIdAsync(request.UserId, request.Page, request.PageSize, cancellationToken);
        var dtos = notes.Select(CreateNoteCommandHandler.ToDto);
        return Result<PaginatedList<NoteDto>>.Success(new PaginatedList<NoteDto>(dtos, totalCount, request.Page, request.PageSize));
    }
}

public class GetAllNotesQueryHandler : IRequestHandler<GetAllNotesQuery, Result<IEnumerable<NoteDto>>>
{
    private readonly IUnitOfWork _unitOfWork;
    public GetAllNotesQueryHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<IEnumerable<NoteDto>>> Handle(GetAllNotesQuery request, CancellationToken cancellationToken)
    {
        var notes = await _unitOfWork.Notes.GetByUserIdAsync(request.UserId, cancellationToken);
        return Result<IEnumerable<NoteDto>>.Success(notes.Select(CreateNoteCommandHandler.ToDto));
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

        return Result<NoteDto>.Success(CreateNoteCommandHandler.ToDto(note), "Note updated successfully.");
    }
}

public record DeleteNoteCommand(Guid NoteId, Guid UserId) : IRequest<Result>;

public class DeleteNoteCommandHandler : IRequestHandler<DeleteNoteCommand, Result>
{
    private readonly IUnitOfWork _unitOfWork;
    public DeleteNoteCommandHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result> Handle(DeleteNoteCommand request, CancellationToken cancellationToken)
    {
        var note = await _unitOfWork.Notes.FirstOrDefaultAsync(n => n.NoteId == request.NoteId && n.UserId == request.UserId, cancellationToken);
        if (note == null) return Result.Failure("Note not found.", "NOTE_NOT_FOUND");

        _unitOfWork.Notes.Remove(note);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return Result.Success("Note deleted successfully.");
    }
}

public record BulkDeleteNotesCommand(IEnumerable<Guid> NoteIds, Guid UserId) : IRequest<Result>;

public class BulkDeleteNotesCommandHandler : IRequestHandler<BulkDeleteNotesCommand, Result>
{
    private readonly IUnitOfWork _unitOfWork;
    public BulkDeleteNotesCommandHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result> Handle(BulkDeleteNotesCommand request, CancellationToken cancellationToken)
    {
        await _unitOfWork.Notes.DeleteByIdsAsync(request.NoteIds, request.UserId, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return Result.Success("Notes deleted successfully.");
    }
}
