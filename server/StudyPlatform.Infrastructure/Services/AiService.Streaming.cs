using System.Net.Http.Headers;
using System.Runtime.CompilerServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.Settings;

namespace StudyPlatform.Infrastructure.Services;

// Public SSE streaming endpoints (summary, mind map, chat).
public partial class AiService
{
    // ── Streaming summary ─────────────────────────────────────────────────

    public async IAsyncEnumerable<string> StreamSummaryAsync(byte[] fileData, string mimeType, [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        await foreach (var chunk in StreamFileTextAsync(fileData, mimeType, AiPrompts.StreamSummary, 0.7, 8192, cancellationToken))
            yield return chunk;
    }

    public async IAsyncEnumerable<string> StreamSummaryAsync(string textContent, [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var prompt = $"{AiPrompts.StreamSummary}\n\nSource material:\n{AiResponseParsing.TruncateContent(textContent)}";
        await foreach (var chunk in StreamTextAsync(null, [("user", prompt)], 0.7, 8192, cancellationToken))
            yield return chunk;
    }

    public async IAsyncEnumerable<string> StreamTimelineSummaryAsync(string timedTranscript, string mediaType, [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var prompt = $"{AiPrompts.TimelineStreamSummary(mediaType)}\n\nTimestamped source material:\n{AiResponseParsing.TruncateContent(timedTranscript)}";
        await foreach (var chunk in StreamTextAsync(null, [("user", prompt)], 0.7, 8192, cancellationToken))
            yield return chunk;
    }

    public async IAsyncEnumerable<string> StreamSummaryFromYouTubeAsync(string transcriptText, [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var prompt = $"{AiPrompts.TimelineStreamSummary("video")}\n\nTimestamped source material:\n{AiResponseParsing.TruncateContent(transcriptText)}";
        await foreach (var chunk in StreamTextAsync(null, [("user", prompt)], 0.7, 8192, cancellationToken))
            yield return chunk;
    }

    // ── Streaming mind map ────────────────────────────────────────────────

    public async IAsyncEnumerable<string> StreamMindMapAsync(byte[] fileData, string mimeType, [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        await foreach (var chunk in StreamFileTextAsync(fileData, mimeType, AiPrompts.MindMap, 0.35, 4096, cancellationToken))
            yield return chunk;
    }

    public async IAsyncEnumerable<string> StreamMindMapAsync(string textContent, [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var prompt = $"{AiPrompts.MindMap}\n\nSource material:\n{AiResponseParsing.TruncateContent(textContent)}";
        await foreach (var chunk in StreamTextAsync(null, [("user", prompt)], 0.35, 4096, cancellationToken))
            yield return chunk;
    }

    public async IAsyncEnumerable<string> StreamMindMapFromYouTubeAsync(string transcriptText, [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var prompt = $"{AiPrompts.YouTubeMindMap}\n\nSource material:\n{AiResponseParsing.TruncateContent(transcriptText)}";
        await foreach (var chunk in StreamTextAsync(null, [("user", prompt)], 0.35, 4096, cancellationToken))
            yield return chunk;
    }

    // ── Streaming chat ────────────────────────────────────────────────────

    public async IAsyncEnumerable<string> StreamChatAsync(string documentContent, string userMessage, IEnumerable<(string role, string content)> history, [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var prompt = AiPrompts.BuildDocumentChatPrompt(AiResponseParsing.TruncateContent(documentContent, 3000), string.Join("\n", history.Select(h => $"{h.role.ToUpper()}: {h.content}")), userMessage);
        await foreach (var chunk in StreamTextAsync(null, [("user", prompt)], 0.7, 8192, cancellationToken))
            yield return chunk;
    }

    public async IAsyncEnumerable<string> StreamChatAsync(string documentContent, string userMessage, IEnumerable<(string role, string content)> history, IReadOnlyList<(byte[] data, string mimeType)> attachments, [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        if (attachments is null || attachments.Count == 0)
        {
            await foreach (var chunk in StreamChatAsync(documentContent, userMessage, history, cancellationToken))
                yield return chunk;
            yield break;
        }

        var system = AiPrompts.BuildDocumentChatSystem(AiResponseParsing.TruncateContent(documentContent, 3000));
        await foreach (var chunk in StreamMultimodalTextAsync(system, history, userMessage, attachments, 0.7, 8192, cancellationToken))
            yield return chunk;
    }

    public async IAsyncEnumerable<string> StreamChatWithYouTubeAsync(string transcriptText, IEnumerable<(string role, string content)> history, string message, [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var system = string.IsNullOrWhiteSpace(transcriptText)
            ? AiPrompts.YouTubeTutorInstruction
            : $"{AiPrompts.YouTubeTutorInstruction}\n\n[Source context]\n{AiResponseParsing.TruncateContent(transcriptText)}";

        var messages = history.Append(("user", message));
        await foreach (var chunk in StreamTextAsync(system, messages, 0.7, 8192, cancellationToken))
            yield return chunk;
    }

    public async IAsyncEnumerable<string> StreamChatWithYouTubeAsync(string transcriptText, IEnumerable<(string role, string content)> history, string message, IReadOnlyList<(byte[] data, string mimeType)> attachments, [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        if (attachments is null || attachments.Count == 0)
        {
            await foreach (var chunk in StreamChatWithYouTubeAsync(transcriptText, history, message, cancellationToken))
                yield return chunk;
            yield break;
        }

        var system = string.IsNullOrWhiteSpace(transcriptText)
            ? AiPrompts.YouTubeTutorInstruction
            : $"{AiPrompts.YouTubeTutorInstruction}\n\n[Source context]\n{AiResponseParsing.TruncateContent(transcriptText)}";
        await foreach (var chunk in StreamMultimodalTextAsync(system, history, message, attachments, 0.7, 8192, cancellationToken))
            yield return chunk;
    }

    public async IAsyncEnumerable<string> StreamGeneralChatAsync(IEnumerable<(string role, string content)> history, string message, [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var messages = history.Append(("user", message));
        await foreach (var chunk in StreamTextAsync(AiPrompts.GeneralTutorInstruction, messages, 0.7, 8192, cancellationToken))
            yield return chunk;
    }

    public async IAsyncEnumerable<string> StreamGeneralChatAsync(IEnumerable<(string role, string content)> history, string message, IReadOnlyList<(byte[] data, string mimeType)> attachments, [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        if (attachments is null || attachments.Count == 0)
        {
            await foreach (var chunk in StreamGeneralChatAsync(history, message, cancellationToken))
                yield return chunk;
            yield break;
        }

        await foreach (var chunk in StreamMultimodalTextAsync(AiPrompts.GeneralTutorInstruction, history, message, attachments, 0.7, 8192, cancellationToken))
            yield return chunk;
    }


}
