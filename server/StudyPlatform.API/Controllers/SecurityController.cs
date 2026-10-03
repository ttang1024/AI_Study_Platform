using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.Application.Security.Commands;
using StudyPlatform.Application.Security.DTOs;
using StudyPlatform.Application.Security.Queries;

namespace StudyPlatform.API.Controllers;

/// <summary>
/// Account security: data export and account deletion (<c>.Data</c>), with the shared plumbing here.
/// </summary>
[ApiController]
[Route("api/security")]
[Authorize]
[Produces("application/json")]
public partial class SecurityController : ControllerBase
{
    private const string RefreshTokenCookieName = "refresh_token";

    private readonly IMediator _mediator;

    public SecurityController(IMediator mediator)
    {
        _mediator = mediator;
    }
}
