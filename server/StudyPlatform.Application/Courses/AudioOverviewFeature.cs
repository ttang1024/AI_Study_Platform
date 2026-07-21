using System.Text.Json;
using MediatR;
using Microsoft.Extensions.Logging;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Courses;

// ── DTOs ────────────────────────────────────────────────────────────────────

public record DialogueTurnDto(string Speaker, string Text);

public record AudioOverviewDto(
    Guid Id,
    Guid CourseId,
    string Status,
    string? AudioUrl,
    int DurationSeconds,
    string? Error,
    IReadOnlyList<DialogueTurnDto>? Script,
    DateTime CreatedAt,
    DateTime? CompletedAt);

// ── Queries / Commands ──────────────────────────────────────────────────────

public record GetAudioOverviewQuery(Guid UserId, Guid CourseId) : IRequest<Result<AudioOverviewDto?>>;

/// <summary>Creates a pending overview row (idempotent while one is in flight). The API layer enqueues generation.</summary>
public record RequestAudioOverviewCommand(Guid UserId, Guid CourseId) : IRequest<Result<AudioOverviewDto>>;

/// <summary>Runs the full pipeline for a pending overview. Executed on a background queue.</summary>
public record GenerateAudioOverviewCommand(Guid OverviewId) : IRequest<Result>;

// ── Handlers ────────────────────────────────────────────────────────────────

public static class AudioOverviewMapping
{
    public static AudioOverviewDto ToDto(this CourseAudioOverview o)
    {
        IReadOnlyList<DialogueTurnDto>? script = null;
        if (!string.IsNullOrEmpty(o.ScriptJson))
        {
            try
            {
                script = JsonSerializer.Deserialize<List<DialogueTurnDto>>(o.ScriptJson,
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            }
            catch (JsonException) { }
        }
        return new AudioOverviewDto(o.Id, o.CourseId, o.Status, o.AudioUrl, o.DurationSeconds, o.Error, script, o.CreatedAt, o.CompletedAt);
    }
}

public class GetAudioOverviewQueryHandler : IRequestHandler<GetAudioOverviewQuery, Result<AudioOverviewDto?>>
{
    private readonly IUnitOfWork _unitOfWork;
    public GetAudioOverviewQueryHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<AudioOverviewDto?>> Handle(GetAudioOverviewQuery request, CancellationToken ct)
    {
        var overview = await _unitOfWork.CourseAudioOverviews.GetLatestForCourseAsync(request.UserId, request.CourseId, ct);
        return Result<AudioOverviewDto?>.Success(overview?.ToDto());
    }
}

public class RequestAudioOverviewCommandHandler : IRequestHandler<RequestAudioOverviewCommand, Result<AudioOverviewDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    public RequestAudioOverviewCommandHandler(IUnitOfWork unitOfWork) { _unitOfWork = unitOfWork; }

    public async Task<Result<AudioOverviewDto>> Handle(RequestAudioOverviewCommand request, CancellationToken ct)
    {
        var course = await _unitOfWork.Courses.GetByIdAsync(request.CourseId, ct);
        if (course == null || course.UserId != request.UserId)
            return Result<AudioOverviewDto>.Failure("Course not found.", "COURSE_NOT_FOUND");

        var latest = await _unitOfWork.CourseAudioOverviews.GetLatestForCourseAsync(request.UserId, request.CourseId, ct);
        if (latest is { Status: "pending" or "processing" })
            return Result<AudioOverviewDto>.Success(latest.ToDto(), "Generation already in progress.");

        // Require some summarized material to talk about.
        var docs = await _unitOfWork.Documents.CountAsync(
            d => d.UserId == request.UserId && d.CourseId == request.CourseId && d.Summary != null, ct);
        var videos = await _unitOfWork.Videos.CountAsync(
            v => v.UserId == request.UserId && v.CourseId == request.CourseId && v.Summary != null, ct);
        if (docs + videos == 0)
            return Result<AudioOverviewDto>.Failure(
                "This course has no summarized materials yet. Summarize a document or video first.", "NO_MATERIALS");

        var overview = new CourseAudioOverview
        {
            Id = Guid.NewGuid(),
            UserId = request.UserId,
            CourseId = request.CourseId,
            Status = "pending",
            CreatedAt = DateTime.UtcNow,
        };
        await _unitOfWork.CourseAudioOverviews.AddAsync(overview, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        return Result<AudioOverviewDto>.Success(overview.ToDto(), "Audio overview queued.");
    }
}

public class GenerateAudioOverviewCommandHandler : IRequestHandler<GenerateAudioOverviewCommand, Result>
{
    private const string VoiceA = "en-US-GuyNeural";
    private const string VoiceB = "en-US-AriaNeural";
    private const int MaxTurns = 80;
    // edge-tts emits 24 kbit/s MP3; used to estimate duration without decoding.
    private const int BytesPerSecond = 3000;
    // Each turn shells out to a separate edge-tts process; bounding concurrency keeps a full
    // 80-turn script from spawning 80 processes at once while still parallelizing the wait.
    private const int TtsConcurrency = 4;

    private readonly IUnitOfWork _unitOfWork;
    private readonly IAiService _aiService;
    private readonly ITtsSynthesisService _tts;
    private readonly IBlobStorageService _blobStorage;
    private readonly ILogger<GenerateAudioOverviewCommandHandler> _logger;

    public GenerateAudioOverviewCommandHandler(
        IUnitOfWork unitOfWork,
        IAiService aiService,
        ITtsSynthesisService tts,
        IBlobStorageService blobStorage,
        ILogger<GenerateAudioOverviewCommandHandler> logger)
    {
        _unitOfWork = unitOfWork;
        _aiService = aiService;
        _tts = tts;
        _blobStorage = blobStorage;
        _logger = logger;
    }

    public async Task<Result> Handle(GenerateAudioOverviewCommand request, CancellationToken ct)
    {
        var overview = await _unitOfWork.CourseAudioOverviews.GetByIdAsync(request.OverviewId, ct);
        if (overview == null)
            return Result.Failure("Overview not found.", "NOT_FOUND");

        overview.Status = "processing";
        await _unitOfWork.SaveChangesAsync(ct);

        try
        {
            var course = await _unitOfWork.Courses.GetByIdAsync(overview.CourseId, ct);
            var digest = await BuildDigestAsync(overview.UserId, overview.CourseId, ct);

            var scriptJson = await _aiService.GenerateAudioOverviewScriptAsync(
                course?.CourseName ?? "this course", digest, ct);
            var turns = ParseScript(scriptJson);
            if (turns.Count == 0)
                throw new InvalidOperationException("AI returned no usable dialogue turns.");

            overview.ScriptJson = JsonSerializer.Serialize(turns);
            await _unitOfWork.SaveChangesAsync(ct);

            // Synthesize each turn with its host's voice, several at a time — MP3 frames concatenate
            // cleanly so turns are written in script order once all syntheses finish, not as each
            // one lands.
            var scriptTurns = turns.Take(MaxTurns).ToList();
            var audioByTurn = new byte[scriptTurns.Count][];
            using (var throttle = new SemaphoreSlim(TtsConcurrency))
            {
                var synthesisTasks = scriptTurns.Select(async (turn, index) =>
                {
                    await throttle.WaitAsync(ct);
                    try
                    {
                        var voice = turn.Speaker.Equals("A", StringComparison.OrdinalIgnoreCase) ? VoiceA : VoiceB;
                        audioByTurn[index] = await _tts.SynthesizeAsync(turn.Text, voice, ct);
                    }
                    finally
                    {
                        throttle.Release();
                    }
                });
                await Task.WhenAll(synthesisTasks);
            }

            using var stitched = new MemoryStream();
            foreach (var bytes in audioByTurn)
                stitched.Write(bytes);

            stitched.Position = 0;
            var blobName = $"audio-overviews/{overview.UserId:N}/{overview.Id:N}.mp3";
            overview.AudioUrl = await _blobStorage.UploadAsync(stitched, blobName, "audio/mpeg", ct);
            overview.DurationSeconds = (int)(stitched.Length / BytesPerSecond);
            overview.Status = "ready";
            overview.CompletedAt = DateTime.UtcNow;
            await _unitOfWork.SaveChangesAsync(ct);

            return Result.Success("Audio overview ready.");
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogError(ex, "Audio overview {OverviewId} failed", overview.Id);
            overview.Status = "failed";
            overview.Error = ex.Message;
            overview.CompletedAt = DateTime.UtcNow;
            await _unitOfWork.SaveChangesAsync(CancellationToken.None);
            return Result.Failure("Audio overview generation failed.", "GENERATION_FAILED");
        }
    }

    private async Task<string> BuildDigestAsync(Guid userId, Guid courseId, CancellationToken ct)
    {
        var parts = new List<string>();

        var docs = await _unitOfWork.Documents.FindAsync(
            d => d.UserId == userId && d.CourseId == courseId && d.Summary != null, ct);
        parts.AddRange(docs.OrderByDescending(d => d.UpdatedAt).Take(12)
            .Select(d => $"## {d.FileName}\n{d.Summary}"));

        var videos = await _unitOfWork.Videos.FindAsync(
            v => v.UserId == userId && v.CourseId == courseId && v.Summary != null, ct);
        parts.AddRange(videos.OrderByDescending(v => v.UpdatedAt).Take(12)
            .Select(v => $"## {v.Title} (video)\n{v.Summary}"));

        return string.Join("\n\n", parts);
    }

    private static List<DialogueTurnDto> ParseScript(string json)
    {
        try
        {
            var turns = JsonSerializer.Deserialize<List<DialogueTurnDto>>(json,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? [];
            return turns
                .Where(t => !string.IsNullOrWhiteSpace(t.Text))
                .Select(t => new DialogueTurnDto(
                    t.Speaker?.Trim().ToUpperInvariant() == "B" ? "B" : "A",
                    t.Text.Trim()))
                .ToList();
        }
        catch (JsonException)
        {
            return [];
        }
    }
}
