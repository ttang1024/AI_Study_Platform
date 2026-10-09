using Microsoft.AspNetCore.Http;

namespace StudyPlatform.Tests.Services;

/// <summary>An accessor whose request carries the X-AI-* headers AiService reads its credentials from.</summary>
internal static class AiTestCredentials
{
    public static IHttpContextAccessor Accessor(string provider, string model, string apiKey)
    {
        var context = new DefaultHttpContext();
        context.Request.Headers["X-AI-Provider"] = provider;
        context.Request.Headers["X-AI-Model"] = model;
        context.Request.Headers["X-AI-Key"] = apiKey;
        return new HttpContextAccessor { HttpContext = context };
    }
}
