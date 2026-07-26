using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Classrooms;
using StudyPlatform.Application.Common;

namespace StudyPlatform.API.Controllers;

/// <summary>
/// Institutions that own classrooms. This is the only controller besides Admin whose reads can
/// legitimately span users, and it does so strictly through an organization-membership check.
/// </summary>
[ApiController]
[Route("api/organizations")]
[Authorize]
[Produces("application/json")]
public class OrganizationsController : ControllerBase
{
    private readonly IMediator _mediator;

    public OrganizationsController(IMediator mediator)
    {
        _mediator = mediator;
    }

    public record CreateOrganizationRequest(string Name);
    public record InviteMemberRequest(string Email, string Role);

    /// <summary>Organizations the caller belongs to.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(BaseResponse<IEnumerable<OrganizationDto>>), 200)]
    public async Task<IActionResult> GetMyOrganizations()
    {
        var result = await _mediator.Send(new GetMyOrganizationsQuery(User.GetUserId()));
        return Ok(BaseResponse<IEnumerable<OrganizationDto>>.Ok(result.Data!));
    }

    /// <summary>Create an organization. The caller becomes its owner.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(BaseResponse<OrganizationDto>), 201)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> CreateOrganization([FromBody] CreateOrganizationRequest request)
    {
        var result = await _mediator.Send(new CreateOrganizationCommand(User.GetUserId(), request.Name));

        if (!result.IsSuccess)
            return BadRequest(BaseResponse<OrganizationDto>.Fail(result.Message, result.ErrorCode));

        return CreatedAtAction(nameof(GetOrganizationDetail), new { id = result.Data!.OrganizationId },
            BaseResponse<OrganizationDto>.Ok(result.Data!, result.Message));
    }

    /// <summary>Organization detail. Full member roster is visible to admins only.</summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(BaseResponse<OrganizationDetailDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> GetOrganizationDetail(Guid id)
    {
        var result = await _mediator.Send(new GetOrganizationDetailQuery(User.GetUserId(), id));

        if (!result.IsSuccess)
            return this.MapClassroomFailure<OrganizationDetailDto>(result.Message, result.ErrorCode);

        return Ok(BaseResponse<OrganizationDetailDto>.Ok(result.Data!));
    }

    /// <summary>Add a member by email, or change an existing member's role.</summary>
    [HttpPost("{id:guid}/members")]
    [ProducesResponseType(typeof(BaseResponse<OrganizationMemberDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> InviteMember(Guid id, [FromBody] InviteMemberRequest request)
    {
        var result = await _mediator.Send(
            new InviteOrganizationMemberCommand(User.GetUserId(), id, request.Email, request.Role));

        if (!result.IsSuccess)
            return this.MapClassroomFailure<OrganizationMemberDto>(result.Message, result.ErrorCode);

        return Ok(BaseResponse<OrganizationMemberDto>.Ok(result.Data!, result.Message));
    }

    /// <summary>Remove a member from the organization.</summary>
    [HttpDelete("{id:guid}/members/{userId:guid}")]
    [ProducesResponseType(typeof(BaseResponse<bool>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> RemoveMember(Guid id, Guid userId)
    {
        var result = await _mediator.Send(new RemoveOrganizationMemberCommand(User.GetUserId(), id, userId));

        if (!result.IsSuccess)
            return this.MapClassroomFailure<bool>(result.Message, result.ErrorCode);

        return Ok(BaseResponse<bool>.Ok(result.Data, result.Message));
    }
}
