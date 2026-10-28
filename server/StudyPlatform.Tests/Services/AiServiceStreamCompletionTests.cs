using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.Settings;
using StudyPlatform.Infrastructure.Services;
using StudyPlatform.Tests.TestSupport;
using Xunit;

namespace StudyPlatform.Tests.Services;

/// <summary>
/// An AI answer has to be finished and well-formed before anything keeps it: a cut-off stream used to be
/// saved as the document's summary, and malformed JSON was cached for 30 days and served on every retry.
/// </summary>
public class AiServiceStreamCompletionTests
{
    private sealed class Canned(Func<HttpContent> body) : HttpMessageHandler
    {
        public int Calls { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Calls++;
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = body() });
        }
    }

    /// <summary>Sends its frames, then neither ends nor sends anything more.</summary>
    private sealed class StallingStream(byte[] prefix) : Stream
    {
        private int _position;

        public override async ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken cancellationToken = default)
        {
            if (_position < prefix.Length)
            {
                var count = Math.Min(buffer.Length, prefix.Length - _position);
                prefix.AsMemory(_position, count).CopyTo(buffer);
                _position += count;
                return count;
            }
            await Task.Delay(Timeout.Infinite, cancellationToken);
            return 0;
        }

        public override int Read(byte[] buffer, int offset, int count) => throw new NotSupportedException();
        public override bool CanRead => true;
        public override bool CanSeek => false;
        public override bool CanWrite => false;
        public override long Length => throw new NotSupportedException();
        public override long Position { get => throw new NotSupportedException(); set => throw new NotSupportedException(); }
        public override void Flush() { }
        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
        public override void SetLength(long value) => throw new NotSupportedException();
        public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
    }

    private static AiService Service(HttpMessageHandler handler, string provider, IAppCache? cache = null, int idleSeconds = 60) => new(
        new HttpClient(handler) { Timeout = Timeout.InfiniteTimeSpan },
        NullLogger<AiService>.Instance,
        AiTestCredentials.Provider(provider, "model", "key"),
        cache ?? Mock.Of<IAppCache>(),
        Options.Create(new CacheOptions()),
        Mock.Of<IAiUsageRecorder>(),
        Options.Create(new AiRequestOptions { StreamIdleTimeoutSeconds = idleSeconds }));

    private static Func<HttpContent> Sse(params string[] frames)
        => () => new StringContent(string.Concat(frames.Select(f => $"data: {f}\n\n")), Encoding.UTF8, "text/event-stream");

    private static string OpenAiDelta(string text, string? finish = null)
        => JsonSerializer.Serialize(new { choices = new[] { new { delta = new { content = text }, finish_reason = finish } } });

    private static async Task<string> ReadAllAsync(IAsyncEnumerable<string> stream)
    {
        var text = new StringBuilder();
        await foreach (var chunk in stream)
            text.Append(chunk);
        return text.ToString();
    }

    [Fact]
    public async Task OpenAiStream_EndingWithDone_Completes()
    {
        var ai = Service(new Canned(Sse(OpenAiDelta("Hello "), OpenAiDelta("world", "stop"), "[DONE]")), "openai");

        Assert.Equal("Hello world", await ReadAllAsync(ai.StreamSummaryAsync("text")));
    }

    [Fact]
    public async Task ClaudeStream_EndingWithMessageStop_Completes()
    {
        var ai = Service(new Canned(Sse(
            """{"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi"}}""",
            """{"type":"message_stop"}""")), "claude");

        Assert.Equal("Hi", await ReadAllAsync(ai.StreamSummaryAsync("text")));
    }

    [Fact]
    public async Task Stream_CutOffBeforeItsFinishMarker_Throws()
    {
        var ai = Service(new Canned(Sse(OpenAiDelta("Half a summ"))), "openai");

        var ex = await Assert.ThrowsAsync<UserFacingException>(() => ReadAllAsync(ai.StreamSummaryAsync("text")));
        Assert.Equal("AI_STREAM_INTERRUPTED", ex.ErrorCode);
    }

    [Fact]
    public async Task ClaudeErrorEvent_MidStream_Throws()
    {
        var ai = Service(new Canned(Sse(
            """{"type":"content_block_delta","delta":{"type":"text_delta","text":"Part"}}""",
            """{"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}""")), "claude");

        var ex = await Assert.ThrowsAsync<AiProviderException>(() => ReadAllAsync(ai.StreamSummaryAsync("text")));
        Assert.Contains("Overloaded", ex.Message);
    }

    [Fact]
    public async Task GeminiAnswerWithheldForSafety_Throws()
    {
        var ai = Service(new Canned(Sse(
            """{"candidates":[{"content":{"parts":[{"text":"Par"}]}}]}""",
            """{"candidates":[{"finishReason":"SAFETY"}]}""")), "gemini");

        await Assert.ThrowsAsync<AiProviderException>(() => ReadAllAsync(ai.StreamSummaryAsync("text")));
    }

    [Fact]
    public async Task StreamThatStallsMidAnswer_TimesOut()
    {
        var prefix = Encoding.UTF8.GetBytes($"data: {OpenAiDelta("Hello")}\n\n");
        var ai = Service(new Canned(() => new StreamContent(new StallingStream(prefix))), "openai", idleSeconds: 1);

        var ex = await Assert.ThrowsAsync<UserFacingException>(() => ReadAllAsync(ai.StreamSummaryAsync("text")));
        Assert.Equal("AI_TIMEOUT", ex.ErrorCode);
    }

    [Fact]
    public async Task MalformedJsonAnswer_IsRejected_AndNotCached()
    {
        // Cut off at max tokens mid-array — the shape a large document produces.
        var truncated = JsonSerializer.Serialize(new { choices = new[] { new { message = new { content = """[{"question":"Q1","options":["a","b"],"correctAnswer":"a"},{"question":"Q2","opt""" } } } });
        var handler = new Canned(() => new StringContent(truncated, Encoding.UTF8, "application/json"));
        var ai = Service(handler, "openai", new InMemoryAppCache());

        var first = await Assert.ThrowsAsync<UserFacingException>(() => ai.GenerateQuizAsync("source"));
        await Assert.ThrowsAsync<UserFacingException>(() => ai.GenerateQuizAsync("source"));

        Assert.Equal("AI_MALFORMED_RESPONSE", first.ErrorCode);
        Assert.Equal(2, handler.Calls); // the retry reached the model instead of the cache
    }
}
