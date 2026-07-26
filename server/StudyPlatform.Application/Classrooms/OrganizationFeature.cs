using FluentValidation;
using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Classrooms;

// ── DTOs ────────────────────────────────────────────────────────────────────

public record OrganizationDto(
    Guid OrganizationId,
    string Name,
    string Slug,
    string MyRole,
    int MemberCount,
    int ClassroomCount,
    DateTime CreatedAt);

public record OrganizationMemberDto(
    Guid UserId,
    string FullName,
    string Email,
    string Role,
    DateTime JoinedAt);

public record OrganizationDetailDto(
    Guid OrganizationId,
    string Name,
    string Slug,
    string MyRole,
    DateTime CreatedAt,
    IEnumerable<OrganizationMemberDto> Members);

// ── Queries ─────────────────────────────────────────────────────────────────

public record GetMyOrganizationsQuery(Guid UserId) : IRequest<Result<IEnumerable<OrganizationDto>>>;

public class GetMyOrganizationsQueryHandler
    : IRequestHandler<GetMyOrganizationsQuery, Result<IEnumerable<OrganizationDto>>>
{
    private readonly IUnitOfWork _unitOfWork;
    public GetMyOrganizationsQueryHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<IEnumerable<OrganizationDto>>> Handle(
        GetMyOrganizationsQuery request, CancellationToken cancellationToken)
    {
        var orgs = await _unitOfWork.Organizations.GetByUserAsync(request.UserId, cancellationToken);

        var dtos = orgs.Select(o => new OrganizationDto(
            o.OrganizationId,
            o.Name,
            o.Slug,
            o.Members.First(m => m.UserId == request.UserId).Role,
            o.Members.Count,
            o.Classrooms.Count,
            o.CreatedAt));

        return Result<IEnumerable<OrganizationDto>>.Success(dtos);
    }
}

public record GetOrganizationDetailQuery(Guid UserId, Guid OrganizationId)
    : IRequest<Result<OrganizationDetailDto>>;

public class GetOrganizationDetailQueryHandler
    : IRequestHandler<GetOrganizationDetailQuery, Result<OrganizationDetailDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    public GetOrganizationDetailQueryHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<OrganizationDetailDto>> Handle(
        GetOrganizationDetailQuery request, CancellationToken cancellationToken)
    {
        var access = await ClassroomAccess.RequireOrganizationRoleAsync(
            _unitOfWork, request.OrganizationId, request.UserId, _ => true, cancellationToken);
        if (!access.IsSuccess)
            return Result<OrganizationDetailDto>.Failure(access.Message, access.ErrorCode);

        var org = await _unitOfWork.Organizations.GetWithMembersAsync(request.OrganizationId, cancellationToken);
        if (org == null)
            return Result<OrganizationDetailDto>.Failure("Organization not found.", "NOT_FOUND");

        // Only administrators see the full roster with email addresses; everyone else sees the
        // teaching staff, which is what a student needs to know who runs the place.
        var visible = OrganizationRoles.CanAdminister(access.Data!)
            ? org.Members
            : org.Members.Where(m => OrganizationRoles.CanTeach(m.Role));

        var dto = new OrganizationDetailDto(
            org.OrganizationId, org.Name, org.Slug, access.Data!, org.CreatedAt,
            visible.Select(m => new OrganizationMemberDto(
                m.UserId, m.User.FullName, m.User.Email, m.Role, m.JoinedAt)));

        return Result<OrganizationDetailDto>.Success(dto);
    }
}

// ── Commands ────────────────────────────────────────────────────────────────

public record CreateOrganizationCommand(Guid UserId, string Name) : IRequest<Result<OrganizationDto>>;

public class CreateOrganizationCommandValidator : AbstractValidator<CreateOrganizationCommand>
{
    public CreateOrganizationCommandValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
    }
}

public class CreateOrganizationCommandHandler
    : IRequestHandler<CreateOrganizationCommand, Result<OrganizationDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    public CreateOrganizationCommandHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<OrganizationDto>> Handle(
        CreateOrganizationCommand request, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;

        string slug;
        var attempts = 0;
        do
        {
            slug = ClassroomAccess.GenerateSlug(request.Name);
            attempts++;
        }
        while (await _unitOfWork.Organizations.GetBySlugAsync(slug, cancellationToken) != null && attempts < 5);

        var org = new Organization
        {
            OrganizationId = Guid.NewGuid(),
            Name = request.Name.Trim(),
            Slug = slug,
            OwnerId = request.UserId,
            CreatedAt = now,
            UpdatedAt = now
        };
        await _unitOfWork.Organizations.AddAsync(org, cancellationToken);

        var membership = new OrganizationMember
        {
            OrganizationMemberId = Guid.NewGuid(),
            OrganizationId = org.OrganizationId,
            UserId = request.UserId,
            Role = OrganizationRoles.Owner,
            JoinedAt = now
        };
        await _unitOfWork.OrganizationMembers.AddAsync(membership, cancellationToken);

        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<OrganizationDto>.Success(
            new OrganizationDto(org.OrganizationId, org.Name, org.Slug, OrganizationRoles.Owner, 1, 0, org.CreatedAt),
            "Organization created.");
    }
}

public record InviteOrganizationMemberCommand(Guid UserId, Guid OrganizationId, string Email, string Role)
    : IRequest<Result<OrganizationMemberDto>>;

public class InviteOrganizationMemberCommandValidator : AbstractValidator<InviteOrganizationMemberCommand>
{
    public InviteOrganizationMemberCommandValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Role).Must(r => OrganizationRoles.All.Contains(r))
            .WithMessage("Role must be one of: owner, admin, instructor, member.");
    }
}

public class InviteOrganizationMemberCommandHandler
    : IRequestHandler<InviteOrganizationMemberCommand, Result<OrganizationMemberDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    public InviteOrganizationMemberCommandHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<OrganizationMemberDto>> Handle(
        InviteOrganizationMemberCommand request, CancellationToken cancellationToken)
    {
        var access = await ClassroomAccess.RequireOrganizationRoleAsync(
            _unitOfWork, request.OrganizationId, request.UserId,
            OrganizationRoles.CanAdminister, cancellationToken);
        if (!access.IsSuccess)
            return Result<OrganizationMemberDto>.Failure(access.Message, access.ErrorCode);

        // Only an owner may mint another owner; an admin promoting themselves would be a privilege
        // escalation from the only role they cannot otherwise reach.
        if (request.Role == OrganizationRoles.Owner && access.Data! != OrganizationRoles.Owner)
            return Result<OrganizationMemberDto>.Failure("Only an owner can grant owner access.", "FORBIDDEN");

        var invitee = await _unitOfWork.Users.FirstOrDefaultAsync(
            u => u.Email == request.Email.Trim().ToLower(), cancellationToken);
        if (invitee == null)
            return Result<OrganizationMemberDto>.Failure("No account exists for that email.", "USER_NOT_FOUND");

        var existing = await _unitOfWork.OrganizationMembers
            .GetMembershipAsync(request.OrganizationId, invitee.UserId, cancellationToken);

        if (existing != null)
        {
            existing.Role = request.Role;
            _unitOfWork.OrganizationMembers.Update(existing);
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            return Result<OrganizationMemberDto>.Success(
                new OrganizationMemberDto(invitee.UserId, invitee.FullName, invitee.Email, existing.Role, existing.JoinedAt),
                "Member role updated.");
        }

        var member = new OrganizationMember
        {
            OrganizationMemberId = Guid.NewGuid(),
            OrganizationId = request.OrganizationId,
            UserId = invitee.UserId,
            Role = request.Role,
            JoinedAt = DateTime.UtcNow
        };
        await _unitOfWork.OrganizationMembers.AddAsync(member, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<OrganizationMemberDto>.Success(
            new OrganizationMemberDto(invitee.UserId, invitee.FullName, invitee.Email, member.Role, member.JoinedAt),
            "Member added.");
    }
}

public record RemoveOrganizationMemberCommand(Guid UserId, Guid OrganizationId, Guid TargetUserId)
    : IRequest<Result<bool>>;

public class RemoveOrganizationMemberCommandHandler
    : IRequestHandler<RemoveOrganizationMemberCommand, Result<bool>>
{
    private readonly IUnitOfWork _unitOfWork;
    public RemoveOrganizationMemberCommandHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<bool>> Handle(
        RemoveOrganizationMemberCommand request, CancellationToken cancellationToken)
    {
        var access = await ClassroomAccess.RequireOrganizationRoleAsync(
            _unitOfWork, request.OrganizationId, request.UserId,
            OrganizationRoles.CanAdminister, cancellationToken);
        if (!access.IsSuccess)
            return Result<bool>.Failure(access.Message, access.ErrorCode);

        var org = await _unitOfWork.Organizations.GetByIdAsync(request.OrganizationId, cancellationToken);
        if (org == null)
            return Result<bool>.Failure("Organization not found.", "NOT_FOUND");

        if (org.OwnerId == request.TargetUserId)
            return Result<bool>.Failure("The organization owner cannot be removed.", "FORBIDDEN");

        var membership = await _unitOfWork.OrganizationMembers
            .GetMembershipAsync(request.OrganizationId, request.TargetUserId, cancellationToken);
        if (membership == null)
            return Result<bool>.Failure("Member not found.", "NOT_FOUND");

        _unitOfWork.OrganizationMembers.Remove(membership);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<bool>.Success(true, "Member removed.");
    }
}
