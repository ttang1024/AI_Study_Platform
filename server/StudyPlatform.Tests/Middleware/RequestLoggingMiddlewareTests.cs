using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.WebUtilities;
using StudyPlatform.API.Middleware;
using Xunit;

namespace StudyPlatform.Tests.Middleware;

public class RequestLoggingMiddlewareTests
{
    private static string Redact(string queryString)
        => RequestLoggingMiddleware.RedactQueryString(new QueryCollection(QueryHelpers.ParseQuery(queryString)));

    [Fact]
    public void AccessToken_IsRedacted_OtherParametersKept()
    {
        var logged = Redact("?access_token=eyJhbGciOi.secret.sig&page=2");

        Assert.DoesNotContain("eyJhbGciOi", logged);
        Assert.Contains("access_token=[REDACTED]", logged);
        Assert.Contains("page=2", logged);
    }

    [Theory]
    [InlineData("?TOKEN=abc")]
    [InlineData("?key=abc")]
    [InlineData("?code=abc")]
    public void SensitiveKeys_AreRedactedCaseInsensitively(string query)
        => Assert.DoesNotContain("abc", Redact(query));

    [Fact]
    public void EmptyQuery_LogsNothing() => Assert.Equal(string.Empty, Redact(""));
}
