using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Essays;

namespace StudyPlatform.API.Controllers;

/// <summary>
/// Peer review over essay drafts. Reviewers see a draft only through an assignment of their own,
/// and authors never see who reviewed them.
/// </summary>
public partial class EssaysController
{
    /// <summary>Asks classmates in a classroom to review one of your drafts.</summary>
    [HttpPost("{id:guid}/peer-review")]
    [ProducesResponseType(typeof(BaseResponse<int>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> RequestPeerReview(Guid id, [FromBody] RequestPeerReviewRequest request)
    {
        var result = await _mediator.Send(new RequestPeerReviewCommand(
            User.GetUserId(), id, request.ClassroomId, request.ReviewerCount));

        if (!result.IsSuccess)
            return BadRequest(BaseResponse<int>.Fail(result.Message, result.ErrorCode, result.Errors));

        return Ok(BaseResponse<int>.Ok(result.Data, result.Message));
    }

    /// <summary>The reviews on your own draft. Anonymous — no reviewer is named.</summary>
    [HttpGet("{id:guid}/peer-review")]
    [ProducesResponseType(typeof(BaseResponse<IReadOnlyList<PeerReviewDto>>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> GetPeerReviews(Guid id)
    {
        var result = await _mediator.Send(new GetPeerReviewsForEssayQuery(User.GetUserId(), id));
        if (!result.IsSuccess)
            return NotFound(BaseResponse<IReadOnlyList<PeerReviewDto>>.Fail(result.Message, result.ErrorCode));

        return Ok(BaseResponse<IReadOnlyList<PeerReviewDto>>.Ok(result.Data!, result.Message));
    }

    /// <summary>Drafts you've been asked to review.</summary>
    [HttpGet("/api/peer-reviews")]
    [ProducesResponseType(typeof(BaseResponse<IReadOnlyList<PeerReviewAssignmentDto>>), 200)]
    public async Task<IActionResult> GetMyPeerReviews([FromQuery] bool includeSubmitted = false)
    {
        var result = await _mediator.Send(new GetMyPeerReviewsQuery(User.GetUserId(), includeSubmitted));
        return Ok(BaseResponse<IReadOnlyList<PeerReviewAssignmentDto>>.Ok(result.Data!, result.Message));
    }

    /// <summary>Opens an assigned draft with its rubric. The only path to another user's essay text.</summary>
    [HttpGet("/api/peer-reviews/{reviewId:guid}")]
    [ProducesResponseType(typeof(BaseResponse<PeerReviewWorkspaceDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> GetPeerReviewWorkspace(Guid reviewId)
    {
        var result = await _mediator.Send(new GetPeerReviewWorkspaceQuery(User.GetUserId(), reviewId));
        if (!result.IsSuccess)
            return NotFound(BaseResponse<PeerReviewWorkspaceDto>.Fail(result.Message, result.ErrorCode));

        return Ok(BaseResponse<PeerReviewWorkspaceDto>.Ok(result.Data!, result.Message));
    }

    /// <summary>Sends your review back to the author.</summary>
    [HttpPost("/api/peer-reviews/{reviewId:guid}")]
    [ProducesResponseType(typeof(BaseResponse<PeerReviewDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> SubmitPeerReview(Guid reviewId, [FromBody] SubmitPeerReviewRequest request)
    {
        var result = await _mediator.Send(new SubmitPeerReviewCommand(
            User.GetUserId(), reviewId, request.Scores ?? Array.Empty<PeerReviewScoreDto>(), request.OverallComment));

        if (!result.IsSuccess)
            return BadRequest(BaseResponse<PeerReviewDto>.Fail(result.Message, result.ErrorCode, result.Errors));

        return Ok(BaseResponse<PeerReviewDto>.Ok(result.Data!, result.Message));
    }
}
