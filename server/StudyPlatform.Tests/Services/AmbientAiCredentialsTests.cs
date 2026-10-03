using StudyPlatform.Application.Services;
using Xunit;

namespace StudyPlatform.Tests.Services;

public class AmbientAiCredentialsTests
{
    [Fact]
    public void Value_NoPush_IsNull()
    {
        Assert.Null(AmbientAiCredentials.Value);
    }

    [Fact]
    public void Push_SetsValueForDurationOfScope()
    {
        var creds = new AiCredentials("openai", "gpt-4", "key", Guid.NewGuid());

        using (AmbientAiCredentials.Push(creds))
        {
            Assert.Equal(creds, AmbientAiCredentials.Value);
        }

        Assert.Null(AmbientAiCredentials.Value);
    }

    [Fact]
    public void Push_Nested_RestoresPreviousOnDispose()
    {
        var outer = new AiCredentials("openai", "gpt-4", "outer-key", Guid.NewGuid());
        var inner = new AiCredentials("anthropic", "claude", "inner-key", Guid.NewGuid());

        using (AmbientAiCredentials.Push(outer))
        {
            Assert.Equal(outer, AmbientAiCredentials.Value);
            using (AmbientAiCredentials.Push(inner))
            {
                Assert.Equal(inner, AmbientAiCredentials.Value);
            }
            Assert.Equal(outer, AmbientAiCredentials.Value);
        }

        Assert.Null(AmbientAiCredentials.Value);
    }

    [Fact]
    public void Dispose_CalledTwice_IsIdempotent()
    {
        var creds = new AiCredentials("openai", "gpt-4", "key", Guid.NewGuid());

        var scope = AmbientAiCredentials.Push(creds);
        scope.Dispose();
        scope.Dispose();

        Assert.Null(AmbientAiCredentials.Value);
    }

    [Fact]
    public async Task Value_IsolatedAcrossAsyncFlows()
    {
        var creds = new AiCredentials("openai", "gpt-4", "key", Guid.NewGuid());

        var task = Task.Run(() =>
        {
            Assert.Null(AmbientAiCredentials.Value);
        });

        using (AmbientAiCredentials.Push(creds))
        {
            await task;
        }
    }
}
