using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.StudyGroups;

// ── DTOs ────────────────────────────────────────────────────────────────────

public record GroupMemberDto(Guid UserId, string UserName, string Role, DateTime JoinedAt);

public record StudyGroupDto(
    Guid StudyGroupId,
    string Name,
    string? Description,
    string InviteCode,
    DateTime CreatedAt,
    int MemberCount,
    int SharedCourseCount);

public record SharedCourseDto(Guid CourseId, string CourseName, DateTime SharedAt);

public record StudyGroupDetailDto(
    Guid StudyGroupId,
    string Name,
    string? Description,
    string InviteCode,
    DateTime CreatedAt,
    IEnumerable<GroupMemberDto> Members,
    IEnumerable<SharedCourseDto> SharedCourses);

public record GroupChatMessageDto(
    Guid GroupChatMessageId,
    Guid UserId,
    string UserName,
    string Content,
    DateTime SentAt);

// ── Queries ─────────────────────────────────────────────────────────────────

public record GetMyGroupsQuery(Guid UserId) : IRequest<Result<IEnumerable<StudyGroupDto>>>;

public class GetMyGroupsQueryHandler : IRequestHandler<GetMyGroupsQuery, Result<IEnumerable<StudyGroupDto>>>
{
    private readonly IUnitOfWork _unitOfWork;
    public GetMyGroupsQueryHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<IEnumerable<StudyGroupDto>>> Handle(GetMyGroupsQuery request, CancellationToken cancellationToken)
    {
        var groups = await _unitOfWork.StudyGroups.GetByUserAsync(request.UserId, cancellationToken);
        var dtos = groups.Select(g => new StudyGroupDto(
            g.StudyGroupId, g.Name, g.Description, g.InviteCode, g.CreatedAt,
            g.Members.Count, g.SharedCourses.Count));
        return Result<IEnumerable<StudyGroupDto>>.Success(dtos);
    }
}

public record GetGroupDetailQuery(Guid UserId, Guid GroupId) : IRequest<Result<StudyGroupDetailDto>>;

public class GetGroupDetailQueryHandler : IRequestHandler<GetGroupDetailQuery, Result<StudyGroupDetailDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    public GetGroupDetailQueryHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<StudyGroupDetailDto>> Handle(GetGroupDetailQuery request, CancellationToken cancellationToken)
    {
        var group = await _unitOfWork.StudyGroups.GetWithMembersAsync(request.GroupId, cancellationToken);
        if (group == null)
            return Result<StudyGroupDetailDto>.Failure("Group not found.", "NOT_FOUND");

        var isMember = group.Members.Any(m => m.UserId == request.UserId);
        if (!isMember)
            return Result<StudyGroupDetailDto>.Failure("Access denied.", "FORBIDDEN");

        var dto = new StudyGroupDetailDto(
            group.StudyGroupId, group.Name, group.Description, group.InviteCode, group.CreatedAt,
            group.Members.Select(m => new GroupMemberDto(m.UserId, m.User.FullName, m.Role, m.JoinedAt)),
            group.SharedCourses.Select(sc => new SharedCourseDto(sc.CourseId, sc.Course.CourseName, sc.SharedAt)));
        return Result<StudyGroupDetailDto>.Success(dto);
    }
}

public record GetGroupChatQuery(Guid UserId, Guid GroupId, int Page) : IRequest<Result<IEnumerable<GroupChatMessageDto>>>;

public class GetGroupChatQueryHandler : IRequestHandler<GetGroupChatQuery, Result<IEnumerable<GroupChatMessageDto>>>
{
    private readonly IUnitOfWork _unitOfWork;
    public GetGroupChatQueryHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<IEnumerable<GroupChatMessageDto>>> Handle(GetGroupChatQuery request, CancellationToken cancellationToken)
    {
        var group = await _unitOfWork.StudyGroups.GetByIdAsync(request.GroupId, cancellationToken);
        if (group == null)
            return Result<IEnumerable<GroupChatMessageDto>>.Failure("Group not found.", "NOT_FOUND");

        var isMember = await _unitOfWork.StudyGroupMembers.ExistsAsync(m => m.GroupId == request.GroupId && m.UserId == request.UserId, cancellationToken);
        if (!isMember)
            return Result<IEnumerable<GroupChatMessageDto>>.Failure("Access denied.", "FORBIDDEN");

        var messages = await _unitOfWork.GroupChatMessages.GetByGroupAsync(request.GroupId, 50, null, cancellationToken);
        var dtos = messages.Select(m => new GroupChatMessageDto(m.GroupChatMessageId, m.UserId, m.User.FullName, m.Content, m.SentAt));
        return Result<IEnumerable<GroupChatMessageDto>>.Success(dtos);
    }
}

// ── Commands ─────────────────────────────────────────────────────────────────

public record CreateStudyGroupCommand(Guid UserId, string Name, string? Description) : IRequest<Result<StudyGroupDto>>;

public class CreateStudyGroupCommandHandler : IRequestHandler<CreateStudyGroupCommand, Result<StudyGroupDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    public CreateStudyGroupCommandHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<StudyGroupDto>> Handle(CreateStudyGroupCommand request, CancellationToken cancellationToken)
    {
        var inviteCode = GenerateInviteCode();

        var group = new StudyGroup
        {
            StudyGroupId = Guid.NewGuid(),
            OwnerId = request.UserId,
            Name = request.Name,
            Description = request.Description,
            InviteCode = inviteCode,
            CreatedAt = DateTime.UtcNow
        };

        await _unitOfWork.StudyGroups.AddAsync(group, cancellationToken);

        var member = new StudyGroupMember
        {
            StudyGroupMemberId = Guid.NewGuid(),
            GroupId = group.StudyGroupId,
            UserId = request.UserId,
            Role = "owner",
            JoinedAt = DateTime.UtcNow
        };

        await _unitOfWork.StudyGroupMembers.AddAsync(member, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<StudyGroupDto>.Success(new StudyGroupDto(
            group.StudyGroupId, group.Name, group.Description, group.InviteCode, group.CreatedAt, 1, 0), "Group created.");
    }

    private static string GenerateInviteCode()
    {
        const string chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        var random = new Random();
        return new string(Enumerable.Repeat(chars, 8).Select(s => s[random.Next(s.Length)]).ToArray());
    }
}

public record JoinStudyGroupCommand(Guid UserId, string InviteCode) : IRequest<Result<StudyGroupDto>>;

public class JoinStudyGroupCommandHandler : IRequestHandler<JoinStudyGroupCommand, Result<StudyGroupDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    public JoinStudyGroupCommandHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<StudyGroupDto>> Handle(JoinStudyGroupCommand request, CancellationToken cancellationToken)
    {
        var group = await _unitOfWork.StudyGroups.GetByInviteCodeAsync(request.InviteCode, cancellationToken);
        if (group == null)
            return Result<StudyGroupDto>.Failure("Invalid invite code.", "INVALID_INVITE_CODE");

        var alreadyMember = group.Members.Any(m => m.UserId == request.UserId);
        if (alreadyMember)
            return Result<StudyGroupDto>.Failure("Already a member.", "ALREADY_MEMBER");

        var member = new StudyGroupMember
        {
            StudyGroupMemberId = Guid.NewGuid(),
            GroupId = group.StudyGroupId,
            UserId = request.UserId,
            Role = "member",
            JoinedAt = DateTime.UtcNow
        };

        await _unitOfWork.StudyGroupMembers.AddAsync(member, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<StudyGroupDto>.Success(new StudyGroupDto(
            group.StudyGroupId, group.Name, group.Description, group.InviteCode, group.CreatedAt,
            group.Members.Count + 1, group.SharedCourses.Count), "Joined group.");
    }
}

public record LeaveStudyGroupCommand(Guid UserId, Guid GroupId) : IRequest<Result>;

public class LeaveStudyGroupCommandHandler : IRequestHandler<LeaveStudyGroupCommand, Result>
{
    private readonly IUnitOfWork _unitOfWork;
    public LeaveStudyGroupCommandHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result> Handle(LeaveStudyGroupCommand request, CancellationToken cancellationToken)
    {
        var member = await _unitOfWork.StudyGroupMembers.FirstOrDefaultAsync(
            m => m.GroupId == request.GroupId && m.UserId == request.UserId, cancellationToken);

        if (member == null)
            return Result.Failure("Not a member.", "NOT_MEMBER");

        if (member.Role == "owner")
            return Result.Failure("Owner cannot leave the group.", "OWNER_CANNOT_LEAVE");

        _unitOfWork.StudyGroupMembers.Remove(member);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return Result.Success("Left group.");
    }
}

public record ShareCourseWithGroupCommand(Guid UserId, Guid GroupId, Guid CourseId) : IRequest<Result>;

public class ShareCourseWithGroupCommandHandler : IRequestHandler<ShareCourseWithGroupCommand, Result>
{
    private readonly IUnitOfWork _unitOfWork;
    public ShareCourseWithGroupCommandHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result> Handle(ShareCourseWithGroupCommand request, CancellationToken cancellationToken)
    {
        var isMember = await _unitOfWork.StudyGroupMembers.ExistsAsync(
            m => m.GroupId == request.GroupId && m.UserId == request.UserId, cancellationToken);
        if (!isMember)
            return Result.Failure("Not a member of this group.", "NOT_MEMBER");

        var groupExists = await _unitOfWork.StudyGroups.ExistsAsync(
            g => g.StudyGroupId == request.GroupId, cancellationToken);
        if (!groupExists)
            return Result.Failure("Group not found.", "NOT_FOUND");

        var alreadyShared = await _unitOfWork.StudyGroupSharedCourses.ExistsAsync(
            sc => sc.GroupId == request.GroupId && sc.CourseId == request.CourseId, cancellationToken);
        if (alreadyShared)
            return Result.Failure("Course already shared.", "ALREADY_SHARED");

        var shared = new StudyGroupSharedCourse
        {
            StudyGroupSharedCourseId = Guid.NewGuid(),
            GroupId = request.GroupId,
            CourseId = request.CourseId,
            SharedAt = DateTime.UtcNow
        };

        await _unitOfWork.StudyGroupSharedCourses.AddAsync(shared, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return Result.Success("Course shared.");
    }
}

public record RemoveSharedCourseCommand(Guid UserId, Guid GroupId, Guid CourseId) : IRequest<Result>;

public class RemoveSharedCourseCommandHandler : IRequestHandler<RemoveSharedCourseCommand, Result>
{
    private readonly IUnitOfWork _unitOfWork;
    public RemoveSharedCourseCommandHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result> Handle(RemoveSharedCourseCommand request, CancellationToken cancellationToken)
    {
        var isMember = await _unitOfWork.StudyGroupMembers.ExistsAsync(
            m => m.GroupId == request.GroupId && m.UserId == request.UserId, cancellationToken);
        if (!isMember)
            return Result.Failure("Not a member of this group.", "NOT_MEMBER");

        var shared = await _unitOfWork.StudyGroupSharedCourses.FirstOrDefaultAsync(
            sc => sc.GroupId == request.GroupId && sc.CourseId == request.CourseId, cancellationToken);
        if (shared == null)
            return Result.Failure("Shared course not found.", "NOT_FOUND");

        _unitOfWork.StudyGroupSharedCourses.Remove(shared);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
        return Result.Success("Course removed.");
    }
}

public record SendGroupChatMessageCommand(Guid UserId, Guid GroupId, string Content) : IRequest<Result<GroupChatMessageDto>>;

public class SendGroupChatMessageCommandHandler : IRequestHandler<SendGroupChatMessageCommand, Result<GroupChatMessageDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    public SendGroupChatMessageCommandHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<GroupChatMessageDto>> Handle(SendGroupChatMessageCommand request, CancellationToken cancellationToken)
    {
        var isMember = await _unitOfWork.StudyGroupMembers.ExistsAsync(
            m => m.GroupId == request.GroupId && m.UserId == request.UserId, cancellationToken);
        if (!isMember)
            return Result<GroupChatMessageDto>.Failure("Not a member of this group.", "NOT_MEMBER");

        var user = await _unitOfWork.Users.GetByIdAsync(request.UserId, cancellationToken);

        var msg = new GroupChatMessage
        {
            GroupChatMessageId = Guid.NewGuid(),
            GroupId = request.GroupId,
            UserId = request.UserId,
            Content = request.Content,
            SentAt = DateTime.UtcNow
        };

        await _unitOfWork.GroupChatMessages.AddAsync(msg, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<GroupChatMessageDto>.Success(
            new GroupChatMessageDto(msg.GroupChatMessageId, msg.UserId, user?.FullName ?? "Unknown", msg.Content, msg.SentAt),
            "Message sent.");
    }
}
