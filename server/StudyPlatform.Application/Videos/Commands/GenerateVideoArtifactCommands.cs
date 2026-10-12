using System.Text.Json;
using MediatR;
using Microsoft.Extensions.Options;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.Settings;
using StudyPlatform.Application.Videos.Transcripts;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Videos.Commands;

// Generating a saved video's flashcards, glossary and quiz from its transcript. Each artifact belongs to
// the user who generated it, so a member of a shared course gets their own set and never touches the
// owner's.

public record GenerateVideoFlashcardsCommand(Guid VideoId, Guid UserId) : IRequest<Result<IEnumerable<FlashcardDto>>>;

public record GenerateVideoGlossaryCommand(Guid VideoId, Guid UserId) : IRequest<Result<IEnumerable<GlossaryTermDto>>>;

public record GenerateVideoQuizCommand(Guid VideoId, Guid UserId, string Difficulty) : IRequest<Result<IEnumerable<QuizDto>>>;

internal static class VideoArtifactGeneration
{
    public const string NoTranscriptMessage = "No subtitles available for this video.";

    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    /// <summary>The model's JSON array, or null when it isn't one.</summary>
    public static List<T>? TryParse<T>(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<List<T>>(json, JsonOptions) ?? [];
        }
        catch (JsonException)
        {
            return null;
        }
    }

    /// <summary>The video plus what generating from it needs: its transcript and the timestamp of each segment.</summary>
    public static async Task<Result<(Video Video, string Transcript, List<(double StartSeconds, int TextOffset)>? Offsets)>> LoadSourceAsync(
        IVideoAccess videoAccess, IVideoTranscriptProvider transcripts, Guid videoId, Guid userId, CancellationToken cancellationToken)
    {
        var video = await videoAccess.GetAccessibleVideoAsync(videoId, userId, cancellationToken);
        if (video is null)
            return Result<(Video, string, List<(double, int)>?)>.Failure("Video not found.", "VIDEO_NOT_FOUND");

        var transcript = await transcripts.GetOrFetchTranscriptAsync(video, cancellationToken);
        if (transcript is null)
            return Result<(Video, string, List<(double, int)>?)>.Failure(NoTranscriptMessage, "NO_TRANSCRIPT");

        var offsets = await transcripts.GetSegmentOffsetsAsync(video, cancellationToken);
        return Result<(Video, string, List<(double, int)>?)>.Success((video, transcript, offsets));
    }

    public static string? Anchor(string transcript, string? quote, List<(double StartSeconds, int TextOffset)>? offsets)
    {
        var anchor = SourceAnchorResolver.ResolveWithTimestamps(transcript, quote, offsets);
        return anchor is null ? null : SourceAnchorResolver.Serialize(anchor);
    }
}

public class GenerateVideoFlashcardsCommandHandler
    : IRequestHandler<GenerateVideoFlashcardsCommand, Result<IEnumerable<FlashcardDto>>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IFlashcardRepository _flashcards;
    private readonly IVideoAccess _videoAccess;
    private readonly IAiService _aiService;
    private readonly IVideoTranscriptProvider _transcripts;

    public GenerateVideoFlashcardsCommandHandler(IUnitOfWork unitOfWork, IFlashcardRepository flashcards, IVideoAccess videoAccess, IAiService aiService, IVideoTranscriptProvider transcripts)
    {
        _unitOfWork = unitOfWork;
        _flashcards = flashcards;
        _videoAccess = videoAccess;
        _aiService = aiService;
        _transcripts = transcripts;
    }

    public async Task<Result<IEnumerable<FlashcardDto>>> Handle(GenerateVideoFlashcardsCommand request, CancellationToken cancellationToken)
    {
        if (await _videoAccess.GetAccessibleVideoAsync(request.VideoId, request.UserId, cancellationToken) is null)
            return Result<IEnumerable<FlashcardDto>>.Failure("Video not found.", "VIDEO_NOT_FOUND");

        // Generated once per user; later calls return the saved set.
        var existing = (await LoadAsync(request, cancellationToken)).ToList();
        if (existing.Count > 0)
            return Result<IEnumerable<FlashcardDto>>.Success(existing);

        var source = await VideoArtifactGeneration.LoadSourceAsync(_videoAccess, _transcripts, request.VideoId, request.UserId, cancellationToken);
        if (!source.IsSuccess)
            return Result<IEnumerable<FlashcardDto>>.Failure(source.Message, source.ErrorCode);
        var (_, transcript, offsets) = source.Data;

        var json = await _aiService.GenerateFlashcardsFromYouTubeAsync(transcript, cancellationToken);
        var cards = VideoArtifactGeneration.TryParse<AiFlashcardItem>(json) ?? [];

        var now = DateTime.UtcNow;
        foreach (var card in cards)
        {
            var isChart = string.Equals(card.Type, "chart", StringComparison.OrdinalIgnoreCase);
            var isCloze = string.Equals(card.Type, "cloze", StringComparison.OrdinalIgnoreCase);
            await _flashcards.AddAsync(new Flashcard
            {
                FlashcardId = Guid.NewGuid(),
                UserId = request.UserId,
                VideoId = request.VideoId,
                SourceType = "video",
                Front = card.Front,
                Back = isChart && card.ChartData.HasValue ? JsonSerializer.Serialize(card.ChartData.Value) : card.Back,
                SourceAnchorJson = VideoArtifactGeneration.Anchor(transcript, card.Quote, offsets),
                CardType = isChart ? "chart" : isCloze ? "cloze" : "basic",
                CreatedAt = now,
                UpdatedAt = now,
            }, cancellationToken);
        }
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Result<IEnumerable<FlashcardDto>>.Success((await LoadAsync(request, cancellationToken)).ToList());
    }

    private async Task<IEnumerable<FlashcardDto>> LoadAsync(GenerateVideoFlashcardsCommand request, CancellationToken cancellationToken)
        => (await _flashcards.FindAsync(f => f.VideoId == request.VideoId && f.UserId == request.UserId, cancellationToken))
            .Select(f => f.ToFlashcardDto());
}

public class GenerateVideoGlossaryCommandHandler
    : IRequestHandler<GenerateVideoGlossaryCommand, Result<IEnumerable<GlossaryTermDto>>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IGlossaryTermRepository _glossaryTerms;
    private readonly IVideoAccess _videoAccess;
    private readonly IAiService _aiService;
    private readonly IVideoTranscriptProvider _transcripts;
    private readonly IAppCache _cache;
    private readonly TimeSpan _ttl;

    public GenerateVideoGlossaryCommandHandler(
        IUnitOfWork unitOfWork, IGlossaryTermRepository glossaryTerms, IVideoAccess videoAccess, IAiService aiService, IVideoTranscriptProvider transcripts, IAppCache cache, IOptions<CacheOptions> cacheOptions)
    {
        _unitOfWork = unitOfWork;
        _glossaryTerms = glossaryTerms;
        _videoAccess = videoAccess;
        _aiService = aiService;
        _transcripts = transcripts;
        _cache = cache;
        _ttl = TimeSpan.FromSeconds(cacheOptions.Value.GeneratedResultSeconds);
    }

    public async Task<Result<IEnumerable<GlossaryTermDto>>> Handle(GenerateVideoGlossaryCommand request, CancellationToken cancellationToken)
    {
        var source = await VideoArtifactGeneration.LoadSourceAsync(_videoAccess, _transcripts, request.VideoId, request.UserId, cancellationToken);
        if (!source.IsSuccess)
            return Result<IEnumerable<GlossaryTermDto>>.Failure(source.Message, source.ErrorCode);
        var (_, transcript, offsets) = source.Data;

        var json = await _aiService.GenerateGlossaryAsync(transcript, cancellationToken);
        var items = VideoArtifactGeneration.TryParse<AiGlossaryItem>(json);
        if (items is null)
            return Result<IEnumerable<GlossaryTermDto>>.Failure("AI returned an unexpected response format.", "PARSE_ERROR");

        // Regenerating replaces this user's terms only. The delete used to match on the video alone, so a
        // shared-course member regenerating wiped the owner's glossary.
        await _glossaryTerms.DeleteByVideoIdAsync(request.VideoId, request.UserId, cancellationToken);

        var now = DateTime.UtcNow;
        var terms = items.Select(item => new GlossaryTerm
        {
            GlossaryTermId = Guid.NewGuid(),
            UserId = request.UserId,
            VideoId = request.VideoId,
            Term = item.Term,
            Definition = item.Definition,
            SourceAnchorJson = VideoArtifactGeneration.Anchor(transcript, item.Quote, offsets),
            CreatedAt = now,
        }).ToList();
        await _glossaryTerms.AddRangeAsync(terms, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var dtos = terms.Select(t => t.ToGlossaryTermDto()).ToList();
        await _cache.SetAsync(VideoCacheKeys.Glossary(request.VideoId, request.UserId), dtos, _ttl, cancellationToken);
        return Result<IEnumerable<GlossaryTermDto>>.Success(dtos, "Glossary generated successfully.");
    }
}

public class GenerateVideoQuizCommandHandler : IRequestHandler<GenerateVideoQuizCommand, Result<IEnumerable<QuizDto>>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IQuizRepository _quizzes;
    private readonly IVideoAccess _videoAccess;
    private readonly IAiService _aiService;
    private readonly IVideoTranscriptProvider _transcripts;
    private readonly IAppCache _cache;
    private readonly TimeSpan _ttl;

    public GenerateVideoQuizCommandHandler(
        IUnitOfWork unitOfWork, IQuizRepository quizzes, IVideoAccess videoAccess, IAiService aiService, IVideoTranscriptProvider transcripts, IAppCache cache, IOptions<CacheOptions> cacheOptions)
    {
        _unitOfWork = unitOfWork;
        _quizzes = quizzes;
        _videoAccess = videoAccess;
        _aiService = aiService;
        _transcripts = transcripts;
        _cache = cache;
        _ttl = TimeSpan.FromSeconds(cacheOptions.Value.GeneratedResultSeconds);
    }

    public async Task<Result<IEnumerable<QuizDto>>> Handle(GenerateVideoQuizCommand request, CancellationToken cancellationToken)
    {
        var difficulty = QuizDifficulty.Normalize(request.Difficulty);
        if (await _videoAccess.GetAccessibleVideoAsync(request.VideoId, request.UserId, cancellationToken) is null)
            return Result<IEnumerable<QuizDto>>.Failure("Video not found.", "VIDEO_NOT_FOUND");

        // Generated once per user and difficulty; later calls return the saved set.
        var existing = (await LoadAsync(request.VideoId, request.UserId, difficulty, cancellationToken)).ToList();
        if (existing.Count > 0)
            return Result<IEnumerable<QuizDto>>.Success(existing);

        var source = await VideoArtifactGeneration.LoadSourceAsync(_videoAccess, _transcripts, request.VideoId, request.UserId, cancellationToken);
        if (!source.IsSuccess)
            return Result<IEnumerable<QuizDto>>.Failure(source.Message, source.ErrorCode);
        var (_, transcript, offsets) = source.Data;

        var json = await _aiService.GenerateQuizFromYouTubeAsync(transcript, difficulty, cancellationToken);
        var items = VideoArtifactGeneration.TryParse<AiQuizItem>(json) ?? [];

        var now = DateTime.UtcNow;
        foreach (var item in items)
        {
            await _quizzes.AddAsync(new Quiz
            {
                QuizId = Guid.NewGuid(),
                UserId = request.UserId,
                VideoId = request.VideoId,
                SourceType = "video",
                Question = item.Question,
                OptionsJson = JsonSerializer.Serialize(item.Options),
                CorrectAnswer = item.CorrectAnswer,
                Explanation = item.Explanation,
                SourceAnchorJson = VideoArtifactGeneration.Anchor(transcript, item.Quote, offsets),
                Difficulty = difficulty,
                CreatedAt = now,
            }, cancellationToken);
        }
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var saved = (await LoadAsync(request.VideoId, request.UserId, difficulty, cancellationToken)).ToList();
        await _cache.SetAsync(VideoCacheKeys.Quiz(request.VideoId, request.UserId, difficulty), saved, _ttl, cancellationToken);
        return Result<IEnumerable<QuizDto>>.Success(saved);
    }

    private async Task<IEnumerable<QuizDto>> LoadAsync(Guid videoId, Guid userId, string difficulty, CancellationToken cancellationToken)
        => (await _quizzes.FindAsync(q => q.VideoId == videoId && q.UserId == userId && q.Difficulty == difficulty, cancellationToken))
            .Select(q => q.ToQuizDto());
}
