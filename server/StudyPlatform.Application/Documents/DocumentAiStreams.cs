using System.Text.Json;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Documents;

/// <summary>
/// Streams a document's AI mind map and summary, storing the finished text on the document. Owner-only:
/// these overwrite the document's own copy.
/// </summary>
public interface IDocumentAiStreams
{
    Task<Result<AiTextStream>> StreamMindMapAsync(Guid documentId, Guid userId, CancellationToken cancellationToken);

    /// <summary>An audio document's timestamped transcript gets a timeline summary; anything else a plain one.</summary>
    Task<Result<AiTextStream>> StreamSummaryAsync(Guid documentId, Guid userId, CancellationToken cancellationToken);
}

/// <inheritdoc cref="IDocumentAiStreams"/>
public sealed class DocumentAiStreams : IDocumentAiStreams
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IDocumentRepository _documents;
    private readonly IAiService _aiService;
    private readonly IDocumentContentService _contentService;

    public DocumentAiStreams(IUnitOfWork unitOfWork, IDocumentRepository documents, IAiService aiService, IDocumentContentService contentService)
    {
        _unitOfWork = unitOfWork;
        _documents = documents;
        _aiService = aiService;
        _contentService = contentService;
    }

    public async Task<Result<AiTextStream>> StreamMindMapAsync(Guid documentId, Guid userId, CancellationToken cancellationToken)
    {
        var document = await _documents.GetOwnedAsync(documentId, userId, cancellationToken);
        if (document == null)
            return Result<AiTextStream>.Failure("Document not found.", "DOCUMENT_NOT_FOUND");

        var (bytes, text) = await _contentService.GetContentAsync(document, cancellationToken);
        var stream = bytes != null
            ? _aiService.StreamMindMapAsync(bytes, document.ContentType, cancellationToken)
            : _aiService.StreamMindMapAsync(text!, cancellationToken);

        return Result<AiTextStream>.Success(new AiTextStream(null, stream, async (result, ct) =>
        {
            document.MindMapText = result;
            document.UpdatedAt = DateTime.UtcNow;
            _documents.Update(document);
            await _unitOfWork.SaveChangesAsync(ct);
        }));
    }

    public async Task<Result<AiTextStream>> StreamSummaryAsync(Guid documentId, Guid userId, CancellationToken cancellationToken)
    {
        var document = await _documents.GetOwnedAsync(documentId, userId, cancellationToken);
        if (document == null)
            return Result<AiTextStream>.Failure("Document not found.", "DOCUMENT_NOT_FOUND");

        var (bytes, text) = await _contentService.GetContentAsync(document, cancellationToken);
        var timelineText = document.ContentType.StartsWith("audio/", StringComparison.OrdinalIgnoreCase)
            ? FormatAudioTranscriptForTimeline(text)
            : null;

        var stream = timelineText != null
            ? _aiService.StreamTimelineSummaryAsync(timelineText, cancellationToken)
            : bytes != null
            ? _aiService.StreamSummaryAsync(bytes, document.ContentType, cancellationToken)
            : _aiService.StreamSummaryAsync(text!, cancellationToken);

        return Result<AiTextStream>.Success(new AiTextStream(null, stream, async (result, ct) =>
        {
            document.Summary = result;
            document.UpdatedAt = DateTime.UtcNow;
            _documents.Update(document);
            await _unitOfWork.SaveChangesAsync(ct);
        }));
    }

    internal static string? FormatAudioTranscriptForTimeline(string? transcript)
    {
        if (string.IsNullOrWhiteSpace(transcript))
            return null;

        try
        {
            using var doc = JsonDocument.Parse(transcript);
            if (doc.RootElement.ValueKind != JsonValueKind.Array)
                return null;

            var lines = new List<string>();
            foreach (var chunk in doc.RootElement.EnumerateArray())
            {
                if (!chunk.TryGetProperty("text", out var textElement))
                    continue;

                var text = textElement.GetString();
                if (string.IsNullOrWhiteSpace(text))
                    continue;

                var start = GetDoubleProperty(chunk, "start");
                if (start is null)
                    continue;

                var end = GetDoubleProperty(chunk, "end");
                var timestamp = end is null
                    ? MediaFormatting.FormatTimestamp(start.Value)
                    : $"{MediaFormatting.FormatTimestamp(start.Value)} – {MediaFormatting.FormatTimestamp(end.Value)}";
                lines.Add($"{timestamp} {text.Trim()}");
            }

            return lines.Count > 0 ? string.Join('\n', lines) : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static double? GetDoubleProperty(JsonElement element, string name)
        => element.TryGetProperty(name, out var property) && property.TryGetDouble(out var value)
            ? value
            : null;
}
