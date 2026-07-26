using Microsoft.AspNetCore.Mvc;
using StudyPlatform.Application.Common;

namespace StudyPlatform.API.Extensions;

/// <summary>
/// Status-code mapping for the role-scoped features (organizations, classrooms, gradebook).
///
/// Elsewhere in the API a failed Result becomes a 400 or a 404 and the error code in the body
/// carries the detail. That is not enough here: the client has to tell "you are signed in but not
/// an instructor" (403 — hide the control) apart from "that classroom does not exist" (404) and
/// "your input was wrong" (400 — show a field error). So these three get distinct statuses.
/// </summary>
public static class ClassroomResponseExtensions
{
    public static IActionResult MapClassroomFailure<T>(
        this ControllerBase controller, string message, string? errorCode)
    {
        var body = BaseResponse<T>.Fail(message, errorCode);

        return errorCode switch
        {
            "FORBIDDEN" => controller.StatusCode(403, body),
            "NOT_FOUND" => controller.NotFound(body),
            "USER_NOT_FOUND" => controller.NotFound(body),
            _ => controller.BadRequest(body)
        };
    }
}
