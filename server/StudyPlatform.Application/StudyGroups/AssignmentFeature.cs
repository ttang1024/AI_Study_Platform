using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.StudyGroups;

// ── DTOs ────────────────────────────────────────────────────────────────────

public record AssignmentCompletionDto(Guid UserId, string Name, DateTime CompletedAt);

public record AssignmentDto(
    Guid Id,
    Guid GroupId,
    Guid CreatedByUserId,
    string Title,
    string? Description,
    string? LinkUrl,
    DateTime? DueAt,
    DateTime CreatedAt,
    bool CompletedByMe,
    int CompletedCount,
    int MemberCount,
    IReadOnlyList<AssignmentCompletionDto> Completions);

// ── Requests ────────────────────────────────────────────────────────────────

public record CreateAssignmentCommand(Guid UserId, Guid GroupId, string Title, string? Description, string? LinkUrl, DateTime? DueAt)
    : IRequest<Result<AssignmentDto>>;
public record GetGroupAssignmentsQuery(Guid UserId, Guid GroupId) : IRequest<Result<IReadOnlyList<AssignmentDto>>>;
public record SetAssignmentCompletionCommand(Guid UserId, Guid AssignmentId, bool Completed) : IRequest<Result<AssignmentDto>>;
public record DeleteAssignmentCommand(Guid UserId, Guid AssignmentId) : IRequest<Result<bool>>;

// ── Handlers ────────────────────────────────────────────────────────────────

public class CreateAssignmentCommandHandler : IRequestHandler<CreateAssignmentCommand, Result<AssignmentDto>>
{
    private readonly IUnitOfWork _unitOfWork;

    public CreateAssignmentCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<AssignmentDto>> Handle(CreateAssignmentCommand request, CancellationToken cancellationToken)
    {
        var group = await _unitOfWork.StudyGroups.GetWithMembersAsync(request.GroupId, cancellationToken);
        if (group == null)
            return Result<AssignmentDto>.Failure("Group not found.", "GROUP_NOT_FOUND");

        var member = group.Members.FirstOrDefault(m => m.UserId == request.UserId);
        if (member == null)
            return Result<AssignmentDto>.Failure("You are not a member of this group.", "NOT_A_MEMBER");
        if (member.Role != "owner")
            return Result<AssignmentDto>.Failure("Only the group owner can post assignments.", "NOT_OWNER");
        if (string.IsNullOrWhiteSpace(request.Title))
            return Result<AssignmentDto>.Failure("Title is required.", "TITLE_REQUIRED");

        var assignment = new GroupAssignment
        {
            GroupAssignmentId = Guid.NewGuid(),
            GroupId = request.GroupId,
            CreatedByUserId = request.UserId,
            Title = request.Title.Trim(),
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            LinkUrl = string.IsNullOrWhiteSpace(request.LinkUrl) ? null : request.LinkUrl.Trim(),
            DueAt = request.DueAt,
            CreatedAt = DateTime.UtcNow,
        };
        await _unitOfWork.GroupAssignments.AddAsync(assignment, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<AssignmentDto>.Success(ToDto(assignment, request.UserId, group.Members.Count), "Assignment posted.");
    }

    internal static AssignmentDto ToDto(GroupAssignment a, Guid currentUserId, int memberCount)
    {
        var completions = a.Completions
            .OrderBy(c => c.CompletedAt)
            .Select(c => new AssignmentCompletionDto(c.UserId, c.User?.FullName ?? "Member", c.CompletedAt))
            .ToList();
        return new AssignmentDto(
            a.GroupAssignmentId, a.GroupId, a.CreatedByUserId, a.Title, a.Description, a.LinkUrl,
            a.DueAt, a.CreatedAt,
            a.Completions.Any(c => c.UserId == currentUserId),
            completions.Count, memberCount, completions);
    }
}

public class GetGroupAssignmentsQueryHandler : IRequestHandler<GetGroupAssignmentsQuery, Result<IReadOnlyList<AssignmentDto>>>
{
    private readonly IUnitOfWork _unitOfWork;

    public GetGroupAssignmentsQueryHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<IReadOnlyList<AssignmentDto>>> Handle(GetGroupAssignmentsQuery request, CancellationToken cancellationToken)
    {
        var group = await _unitOfWork.StudyGroups.GetWithMembersAsync(request.GroupId, cancellationToken);
        if (group == null)
            return Result<IReadOnlyList<AssignmentDto>>.Failure("Group not found.", "GROUP_NOT_FOUND");
        if (group.Members.All(m => m.UserId != request.UserId))
            return Result<IReadOnlyList<AssignmentDto>>.Failure("You are not a member of this group.", "NOT_A_MEMBER");

        var assignments = await _unitOfWork.GroupAssignments.GetByGroupWithCompletionsAsync(request.GroupId, cancellationToken);
        var dtos = assignments
            .Select(a => CreateAssignmentCommandHandler.ToDto(a, request.UserId, group.Members.Count))
            .ToList();
        return Result<IReadOnlyList<AssignmentDto>>.Success(dtos);
    }
}

public class SetAssignmentCompletionCommandHandler : IRequestHandler<SetAssignmentCompletionCommand, Result<AssignmentDto>>
{
    private readonly IUnitOfWork _unitOfWork;

    public SetAssignmentCompletionCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<AssignmentDto>> Handle(SetAssignmentCompletionCommand request, CancellationToken cancellationToken)
    {
        var assignment = await _unitOfWork.GroupAssignments.GetByIdWithCompletionsAsync(request.AssignmentId, cancellationToken);
        if (assignment == null)
            return Result<AssignmentDto>.Failure("Assignment not found.", "ASSIGNMENT_NOT_FOUND");

        var group = await _unitOfWork.StudyGroups.GetWithMembersAsync(assignment.GroupId, cancellationToken);
        if (group == null || group.Members.All(m => m.UserId != request.UserId))
            return Result<AssignmentDto>.Failure("You are not a member of this group.", "NOT_A_MEMBER");

        var existing = assignment.Completions.FirstOrDefault(c => c.UserId == request.UserId);
        if (request.Completed && existing == null)
        {
            await _unitOfWork.GroupAssignments.AddCompletionAsync(new GroupAssignmentCompletion
            {
                GroupAssignmentCompletionId = Guid.NewGuid(),
                AssignmentId = assignment.GroupAssignmentId,
                UserId = request.UserId,
                CompletedAt = DateTime.UtcNow,
            }, cancellationToken);
        }
        else if (!request.Completed && existing != null)
        {
            assignment.Completions.Remove(existing);
        }
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var refreshed = await _unitOfWork.GroupAssignments.GetByIdWithCompletionsAsync(request.AssignmentId, cancellationToken);
        return Result<AssignmentDto>.Success(
            CreateAssignmentCommandHandler.ToDto(refreshed!, request.UserId, group.Members.Count), "Updated.");
    }
}

public class DeleteAssignmentCommandHandler : IRequestHandler<DeleteAssignmentCommand, Result<bool>>
{
    private readonly IUnitOfWork _unitOfWork;

    public DeleteAssignmentCommandHandler(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<Result<bool>> Handle(DeleteAssignmentCommand request, CancellationToken cancellationToken)
    {
        var assignment = await _unitOfWork.GroupAssignments.GetByIdWithCompletionsAsync(request.AssignmentId, cancellationToken);
        if (assignment == null)
            return Result<bool>.Failure("Assignment not found.", "ASSIGNMENT_NOT_FOUND");

        // The poster or the group owner can remove it.
        var group = await _unitOfWork.StudyGroups.GetWithMembersAsync(assignment.GroupId, cancellationToken);
        var isOwner = group?.Members.Any(m => m.UserId == request.UserId && m.Role == "owner") ?? false;
        if (assignment.CreatedByUserId != request.UserId && !isOwner)
            return Result<bool>.Failure("Only the poster or group owner can delete an assignment.", "FORBIDDEN");

        _unitOfWork.GroupAssignments.Remove(assignment);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return Result<bool>.Success(true, "Assignment deleted.");
    }
}
