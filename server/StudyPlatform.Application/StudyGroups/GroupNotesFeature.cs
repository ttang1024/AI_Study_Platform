using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.StudyGroups;

// ── DTOs ────────────────────────────────────────────────────────────────────

public record GroupNoteSummaryDto(
    Guid Id, Guid GroupId, string Title, string ContentPreview,
    Guid CreatedBy, Guid? LastEditedBy, DateTime CreatedAt, DateTime UpdatedAt);

/// <summary>Full note incl. the Yjs document state (base64) used to hydrate an editor.</summary>
public record GroupNoteDto(
    Guid Id, Guid GroupId, string Title, string StateBase64,
    Guid CreatedBy, Guid? LastEditedBy, DateTime CreatedAt, DateTime UpdatedAt);

public record CreateGroupNoteRequest(string Title);

// ── Queries / Commands ──────────────────────────────────────────────────────

public record GetGroupNotesQuery(Guid GroupId, Guid UserId) : IRequest<Result<IReadOnlyList<GroupNoteSummaryDto>>>;

public record GetGroupNoteQuery(Guid NoteId, Guid UserId) : IRequest<Result<GroupNoteDto>>;

public record CreateGroupNoteCommand(Guid GroupId, Guid UserId, string Title) : IRequest<Result<GroupNoteSummaryDto>>;

public record DeleteGroupNoteCommand(Guid NoteId, Guid UserId) : IRequest<Result>;

/// <summary>Persists the merged Yjs state (called from the hub on debounced saves).</summary>
public record SaveGroupNoteStateCommand(Guid NoteId, Guid UserId, byte[] State, string ContentPreview) : IRequest<Result>;

// ── Handlers ────────────────────────────────────────────────────────────────

public class GetGroupNotesQueryHandler : IRequestHandler<GetGroupNotesQuery, Result<IReadOnlyList<GroupNoteSummaryDto>>>
{
    private readonly IUnitOfWork _unitOfWork;
    public GetGroupNotesQueryHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<IReadOnlyList<GroupNoteSummaryDto>>> Handle(GetGroupNotesQuery request, CancellationToken ct)
    {
        var isMember = await _unitOfWork.StudyGroupMembers.ExistsAsync(
            m => m.GroupId == request.GroupId && m.UserId == request.UserId, ct);
        if (!isMember)
            return Result<IReadOnlyList<GroupNoteSummaryDto>>.Failure("You are not a member of this group.", "NOT_A_MEMBER");

        var notes = await _unitOfWork.GroupNotes.GetByGroupAsync(request.GroupId, ct);
        var dtos = notes.Select(n => new GroupNoteSummaryDto(
            n.Id, n.GroupId, n.Title, n.ContentPreview, n.CreatedBy, n.LastEditedBy, n.CreatedAt, n.UpdatedAt)).ToList();
        return Result<IReadOnlyList<GroupNoteSummaryDto>>.Success(dtos);
    }
}

public class GetGroupNoteQueryHandler : IRequestHandler<GetGroupNoteQuery, Result<GroupNoteDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    public GetGroupNoteQueryHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<GroupNoteDto>> Handle(GetGroupNoteQuery request, CancellationToken ct)
    {
        var note = await _unitOfWork.GroupNotes.GetByIdAsync(request.NoteId, ct);
        if (note == null)
            return Result<GroupNoteDto>.Failure("Note not found.", "NOTE_NOT_FOUND");

        var isMember = await _unitOfWork.StudyGroupMembers.ExistsAsync(
            m => m.GroupId == note.GroupId && m.UserId == request.UserId, ct);
        if (!isMember)
            return Result<GroupNoteDto>.Failure("You are not a member of this group.", "NOT_A_MEMBER");

        return Result<GroupNoteDto>.Success(new GroupNoteDto(
            note.Id, note.GroupId, note.Title, Convert.ToBase64String(note.State),
            note.CreatedBy, note.LastEditedBy, note.CreatedAt, note.UpdatedAt));
    }
}

public class CreateGroupNoteCommandHandler : IRequestHandler<CreateGroupNoteCommand, Result<GroupNoteSummaryDto>>
{
    private const int MaxNotesPerGroup = 50;

    private readonly IUnitOfWork _unitOfWork;
    public CreateGroupNoteCommandHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<GroupNoteSummaryDto>> Handle(CreateGroupNoteCommand request, CancellationToken ct)
    {
        var isMember = await _unitOfWork.StudyGroupMembers.ExistsAsync(
            m => m.GroupId == request.GroupId && m.UserId == request.UserId, ct);
        if (!isMember)
            return Result<GroupNoteSummaryDto>.Failure("You are not a member of this group.", "NOT_A_MEMBER");

        var count = await _unitOfWork.GroupNotes.CountAsync(n => n.GroupId == request.GroupId, ct);
        if (count >= MaxNotesPerGroup)
            return Result<GroupNoteSummaryDto>.Failure($"A group can have at most {MaxNotesPerGroup} shared notes.", "TOO_MANY_NOTES");

        var note = new GroupNote
        {
            Id = Guid.NewGuid(),
            GroupId = request.GroupId,
            Title = string.IsNullOrWhiteSpace(request.Title) ? "Untitled note" : request.Title.Trim(),
            CreatedBy = request.UserId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };
        await _unitOfWork.GroupNotes.AddAsync(note, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        return Result<GroupNoteSummaryDto>.Success(new GroupNoteSummaryDto(
            note.Id, note.GroupId, note.Title, "", note.CreatedBy, null, note.CreatedAt, note.UpdatedAt),
            "Note created.");
    }
}

public class DeleteGroupNoteCommandHandler : IRequestHandler<DeleteGroupNoteCommand, Result>
{
    private readonly IUnitOfWork _unitOfWork;
    public DeleteGroupNoteCommandHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result> Handle(DeleteGroupNoteCommand request, CancellationToken ct)
    {
        var note = await _unitOfWork.GroupNotes.GetByIdAsync(request.NoteId, ct);
        if (note == null)
            return Result.Failure("Note not found.", "NOTE_NOT_FOUND");

        var group = await _unitOfWork.StudyGroups.GetByIdAsync(note.GroupId, ct);
        var isOwner = group?.OwnerId == request.UserId || note.CreatedBy == request.UserId;
        if (!isOwner)
            return Result.Failure("Only the note's creator or the group owner can delete it.", "FORBIDDEN");

        _unitOfWork.GroupNotes.Remove(note);
        await _unitOfWork.SaveChangesAsync(ct);
        return Result.Success("Note deleted.");
    }
}

public class SaveGroupNoteStateCommandHandler : IRequestHandler<SaveGroupNoteStateCommand, Result>
{
    private const int MaxStateBytes = 2 * 1024 * 1024;

    private readonly IUnitOfWork _unitOfWork;
    public SaveGroupNoteStateCommandHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result> Handle(SaveGroupNoteStateCommand request, CancellationToken ct)
    {
        if (request.State.Length > MaxStateBytes)
            return Result.Failure("Note is too large.", "NOTE_TOO_LARGE");

        var note = await _unitOfWork.GroupNotes.GetByIdAsync(request.NoteId, ct);
        if (note == null)
            return Result.Failure("Note not found.", "NOTE_NOT_FOUND");

        var isMember = await _unitOfWork.StudyGroupMembers.ExistsAsync(
            m => m.GroupId == note.GroupId && m.UserId == request.UserId, ct);
        if (!isMember)
            return Result.Failure("You are not a member of this group.", "NOT_A_MEMBER");

        note.State = request.State;
        note.ContentPreview = request.ContentPreview.Length > 500
            ? request.ContentPreview[..500]
            : request.ContentPreview;
        note.LastEditedBy = request.UserId;
        note.UpdatedAt = DateTime.UtcNow;
        _unitOfWork.GroupNotes.Update(note);
        await _unitOfWork.SaveChangesAsync(ct);
        return Result.Success();
    }
}
