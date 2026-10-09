using System.Reflection;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Routing;
using StudyPlatform.API.Controllers;
using StudyPlatform.API.Hubs;
using Xunit;

namespace StudyPlatform.Tests.Security;

/// <summary>
/// Every endpoint either requires authentication or is on the reviewed list below. Adding an anonymous
/// endpoint — or forgetting [Authorize] on a new controller — fails this test, so the decision is made
/// deliberately, in review, rather than discovered later. Anonymous endpoints must do their own access
/// control (a share token, a signed media token, the beacon's own rate limit).
/// </summary>
public class AuthorizationInventoryTests
{
    private static readonly HashSet<string> ReviewedAnonymousEndpoints =
    [
        // Sign-in / sign-up / recovery: there is no session yet.
        "AuthController.Register", "AuthController.Login", "AuthController.RefreshToken", "AuthController.Logout",
        "AuthController.SendOtp", "AuthController.ResetPassword", "AuthController.OAuthLogin",
        "AuthController.GoogleCredentialLogin",
        // Public share links: the unguessable token is the capability.
        "ShareController.GetShare", "ShareController.StreamAudio", "ShareController.GetArticle",
        "ShareController.StreamFile", "ShareController.StreamVideo",
        "SharePreviewController.GetSharePage",
        // <video>/<img> cannot send headers; these validate ?access_token= themselves.
        "VideoController.GetUploadedVideoFile", "VideoController.GetUploadedVideoThumbnail",
        // Admin sign-in (same single failure answer as user login; tighter rate limit).
        "AdminController.Login",
        // Anonymous page-view beacon (attributes the user when a token happens to be present).
        "AnalyticsController.RecordPageVisit",
    ];

    private static IEnumerable<(string Name, bool Anonymous)> Endpoints()
    {
        var controllers = typeof(ShareController).Assembly.GetTypes()
            .Where(t => typeof(ControllerBase).IsAssignableFrom(t) && !t.IsAbstract);
        foreach (var controller in controllers)
        {
            var classRequiresAuth = controller.GetCustomAttributes<AuthorizeAttribute>(true).Any();
            var classAllowsAnonymous = controller.GetCustomAttributes<AllowAnonymousAttribute>(true).Any();
            var actions = controller.GetMethods(BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly)
                .Where(m => m.GetCustomAttributes<HttpMethodAttribute>().Any());
            foreach (var action in actions)
            {
                var anonymous = action.GetCustomAttributes<AllowAnonymousAttribute>().Any()
                    || classAllowsAnonymous
                    || (!classRequiresAuth && !action.GetCustomAttributes<AuthorizeAttribute>().Any());
                yield return ($"{controller.Name}.{action.Name}", anonymous);
            }
        }
    }

    [Fact]
    public void EveryAnonymousEndpoint_IsOnTheReviewedList()
    {
        var unexpected = Endpoints().Where(e => e.Anonymous && !ReviewedAnonymousEndpoints.Contains(e.Name))
            .Select(e => e.Name).OrderBy(n => n).ToList();

        Assert.True(unexpected.Count == 0,
            "Endpoints reachable without authentication that are not on the reviewed list: "
            + string.Join(", ", unexpected));
    }

    [Fact]
    public void ReviewedList_HasNoStaleEntries()
    {
        var anonymous = Endpoints().Where(e => e.Anonymous).Select(e => e.Name).ToHashSet();
        var stale = ReviewedAnonymousEndpoints.Where(n => !anonymous.Contains(n)).OrderBy(n => n).ToList();

        Assert.True(stale.Count == 0, "No longer anonymous (remove from the list): " + string.Join(", ", stale));
    }

    [Fact]
    public void ChatHub_RequiresAuthentication()
        => Assert.NotEmpty(typeof(GroupChatHub).GetCustomAttributes<AuthorizeAttribute>(true));
}
