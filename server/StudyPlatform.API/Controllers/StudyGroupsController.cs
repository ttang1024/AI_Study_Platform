using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using StudyPlatform.API.Hubs;

namespace StudyPlatform.API.Controllers;

// Study groups feature. Actions are split by concern across partial-class files:
//   .Groups        — group lifecycle & membership
//   .SharedCourses — sharing courses into a group
//   .Chat          — group chat
//   .Battles       — leaderboard & quiz battles
//   .Assignments   — group assignments
//   .Notes         — collaborative notes
[ApiController]
[Route("api/study-groups")]
[Authorize]
[Produces("application/json")]
public partial class StudyGroupsController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly IHubContext<GroupChatHub> _hubContext;

    public StudyGroupsController(IMediator mediator, IHubContext<GroupChatHub> hubContext)
    {
        _mediator = mediator;
        _hubContext = hubContext;
    }
}
