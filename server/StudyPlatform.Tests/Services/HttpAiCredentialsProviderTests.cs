using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using StudyPlatform.Application.Common;
using StudyPlatform.Infrastructure.Services;
using Xunit;

namespace StudyPlatform.Tests.Services;

public class HttpAiCredentialsProviderTests
{
    private static HttpAiCredentialsProvider For(string? provider, string? model, string? key, Guid? userId = null)
    {
        var context = new DefaultHttpContext();
        if (provider != null) context.Request.Headers["X-AI-Provider"] = provider;
        if (model != null) context.Request.Headers["X-AI-Model"] = model;
        if (key != null) context.Request.Headers["X-AI-Key"] = key;
        if (userId != null)
            context.User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, userId.ToString()!)], "test"));
        return new HttpAiCredentialsProvider(new HttpContextAccessor { HttpContext = context });
    }

    [Fact]
    public void ReadsTheTriple_AndTheCallingUser()
    {
        var userId = Guid.NewGuid();
        var credentials = For(" OpenAI ", "gpt-4o-mini", " sk-1 ", userId).GetRequired();

        Assert.Equal("openai", credentials.Provider);
        Assert.Equal("gpt-4o-mini", credentials.Model);
        Assert.Equal("sk-1", credentials.ApiKey);
        Assert.Equal(userId, credentials.UserId);
    }

    [Fact]
    public void RejectsAnUnknownProvider_InsteadOfFallingBackToGemini()
    {
        var ex = Assert.Throws<UserFacingException>(() => For("mystery-ai", "m", "k").GetRequired());
        Assert.Contains("Unsupported AI provider", ex.Message);
    }

    [Theory]
    [InlineData(null, "m", "k", "No AI provider")]
    [InlineData("openai", null, "k", "No AI model")]
    [InlineData("openai", "m", null, "No API key")]
    public void SaysWhatIsMissing(string? provider, string? model, string? key, string expected)
        => Assert.Contains(expected, Assert.Throws<UserFacingException>(() => For(provider, model, key).GetRequired()).Message);

    [Fact]
    public void CacheScope_DiffersBetweenUsersWithTheSameModel()
    {
        var a = For("openai", "gpt-4o-mini", "k", Guid.NewGuid()).GetRequired();
        var b = For("openai", "gpt-4o-mini", "k", Guid.NewGuid()).GetRequired();
        Assert.NotEqual(a.CacheScope, b.CacheScope);
    }
}
