using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Application.Notes.DTOs;
using StudyPlatform.Application.YouTube.Commands;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.API.Controllers;

// Persisted video flashcards, glossary & quiz endpoints.
public partial class VideoController
{
    // ── Video Flashcards ──────────────────────────────────────────────────

    [HttpGet("{id:guid}/flashcards")]
    public async Task<IActionResult> GetVideoFlashcards(Guid id, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var video = await GetVideoWithAccessCheckAsync(id, userId, cancellationToken);
        if (video is null)
            return NotFound(BaseResponse<IEnumerable<FlashcardDto>>.Fail("Video not found.", "VIDEO_NOT_FOUND"));

        var flashcards = await _unitOfWork.Flashcards.FindAsync(f => f.YouTubeVideoId == id && f.UserId == video.UserId, cancellationToken);
        var dtos = flashcards.Select(f => f.ToFlashcardDto()).ToList();
        return Ok(BaseResponse<IEnumerable<FlashcardDto>>.Ok(dtos));
    }

    [HttpGet("{id:guid}/notes")]
    public async Task<IActionResult> GetVideoNotes(Guid id, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var video = await GetVideoWithAccessCheckAsync(id, userId, cancellationToken);
        if (video is null)
            return NotFound(BaseResponse<IEnumerable<NoteDto>>.Fail("Video not found.", "VIDEO_NOT_FOUND"));

        var notes = await _unitOfWork.Notes.FindAsync(n => n.YouTubeVideoId == id && n.UserId == video.UserId, cancellationToken);
        var dtos = notes
            .OrderByDescending(n => n.CreatedAt)
            .Select(n => n.ToNoteDto());
        return Ok(BaseResponse<IEnumerable<NoteDto>>.Ok(dtos));
    }

    [HttpPost("{id:guid}/flashcards/generate")]
    public async Task<IActionResult> GenerateVideoFlashcards(Guid id, [FromBody] YouTubeUrlRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var video = await GetVideoWithAccessCheckAsync(id, userId, cancellationToken);
        if (video is null)
            return NotFound(BaseResponse<IEnumerable<FlashcardDto>>.Fail("Video not found.", "VIDEO_NOT_FOUND"));

        // Return cached flashcards if they already exist
        var existing = (await _unitOfWork.Flashcards.FindAsync(f => f.YouTubeVideoId == id && f.UserId == userId, cancellationToken)).ToList();
        if (existing.Count > 0)
            return Ok(BaseResponse<IEnumerable<FlashcardDto>>.Ok(existing.Select(f => f.ToFlashcardDto())));

        // No cached data — fetch transcript and generate
        var transcript = await GetOrFetchTranscriptAsync(video, cancellationToken);
        if (transcript == null)
            return BadRequest(BaseResponse<IEnumerable<FlashcardDto>>.Fail("No subtitles available for this video.", "NO_TRANSCRIPT"));

        var resultJson = await _aiService.GenerateFlashcardsFromYouTubeAsync(transcript, cancellationToken);

        List<AiFlashcardItem> cards;
        try
        {
            cards = JsonSerializer.Deserialize<List<AiFlashcardItem>>(resultJson,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? [];
        }
        catch
        {
            cards = [];
        }

        foreach (var card in cards)
        {
            var isChart = string.Equals(card.Type, "chart", StringComparison.OrdinalIgnoreCase);
            var isCloze = string.Equals(card.Type, "cloze", StringComparison.OrdinalIgnoreCase);
            var back = isChart && card.ChartData.HasValue
                ? JsonSerializer.Serialize(card.ChartData.Value)
                : card.Back;
            await _unitOfWork.Flashcards.AddAsync(new Flashcard
            {
                FlashcardId = Guid.NewGuid(),
                UserId = userId,
                YouTubeVideoId = id,
                SourceType = "video",
                Front = card.Front,
                Back = back,
                CardType = isChart ? "chart" : isCloze ? "cloze" : "basic",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            }, cancellationToken);
        }
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var saved = await _unitOfWork.Flashcards.FindAsync(f => f.YouTubeVideoId == id && f.UserId == userId, cancellationToken);
        var savedDtos = saved.Select(f => f.ToFlashcardDto()).ToList();
        return Ok(BaseResponse<IEnumerable<FlashcardDto>>.Ok(savedDtos));
    }

    // ── Video Glossary ────────────────────────────────────────────────────

    [HttpGet("{id:guid}/glossary")]
    public async Task<IActionResult> GetVideoGlossary(Guid id, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var ttl = TimeSpan.FromSeconds(_cacheOptions.GeneratedResultSeconds);
        var cacheKey = VideoGlossaryCacheKey(id, userId);

        var cached = await _cache.GetAsync<List<GlossaryTermDto>>(cacheKey, cancellationToken);
        if (cached != null)
            return Ok(BaseResponse<IEnumerable<GlossaryTermDto>>.Ok(cached));

        var terms = await _unitOfWork.GlossaryTerms.GetByVideoIdAsync(id, cancellationToken);
        var dtos = terms.Where(t => t.UserId == userId)
            .Select(t => t.ToGlossaryTermDto())
            .ToList();
        if (dtos.Count > 0)
            await _cache.SetAsync(cacheKey, dtos, ttl, cancellationToken);
        return Ok(BaseResponse<IEnumerable<GlossaryTermDto>>.Ok(dtos));
    }

    [HttpPost("{id:guid}/glossary/generate")]
    public async Task<IActionResult> GenerateVideoGlossary(Guid id, [FromBody] YouTubeUrlRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var video = await GetVideoWithAccessCheckAsync(id, userId, cancellationToken);
        if (video is null)
            return NotFound(BaseResponse<IEnumerable<GlossaryTermDto>>.Fail("Video not found.", "VIDEO_NOT_FOUND"));

        try
        {
            // Delete existing terms and invalidate cache to allow regeneration
            await _unitOfWork.GlossaryTerms.DeleteByVideoIdAsync(id, cancellationToken);
            await _cache.RemoveAsync(VideoGlossaryCacheKey(id, userId), cancellationToken);

            var transcript = await GetOrFetchTranscriptAsync(video, cancellationToken);
            if (transcript == null)
                return BadRequest(BaseResponse<IEnumerable<GlossaryTermDto>>.Fail("No subtitles available for this video.", "NO_TRANSCRIPT"));

            var resultJson = await _aiService.GenerateGlossaryAsync(transcript, cancellationToken);

            List<AiGlossaryItem> items;
            try
            {
                items = System.Text.Json.JsonSerializer.Deserialize<List<AiGlossaryItem>>(resultJson,
                    new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? [];
            }
            catch
            {
                return BadRequest(BaseResponse<IEnumerable<GlossaryTermDto>>.Fail("AI returned an unexpected response format.", "PARSE_ERROR"));
            }

            foreach (var item in items)
            {
                await _unitOfWork.GlossaryTerms.AddAsync(new StudyPlatform.Domain.Entities.GlossaryTerm
                {
                    GlossaryTermId = Guid.NewGuid(),
                    UserId = userId,
                    YouTubeVideoId = id,
                    Term = item.Term,
                    Definition = item.Definition,
                    CreatedAt = DateTime.UtcNow
                }, cancellationToken);
            }
            await _unitOfWork.SaveChangesAsync(cancellationToken);

            var saved = await _unitOfWork.GlossaryTerms.GetByVideoIdAsync(id, cancellationToken);
            var dtos = saved.Where(t => t.UserId == userId)
                .Select(t => t.ToGlossaryTermDto())
                .ToList();
            await _cache.SetAsync(VideoGlossaryCacheKey(id, userId), dtos, TimeSpan.FromSeconds(_cacheOptions.GeneratedResultSeconds), cancellationToken);
            return Ok(BaseResponse<IEnumerable<GlossaryTermDto>>.Ok(dtos, "Glossary generated successfully."));
        }
        catch (Exception ex)
        {
            if (AiErrorMapper.TryGetAiError(ex.Message, out _, out _))
                return AiErrorMapper.ToObjectResult<IEnumerable<GlossaryTermDto>>(this, ex.Message);

            return BadRequest(BaseResponse<IEnumerable<GlossaryTermDto>>.Fail(
                $"Failed to generate glossary: {ex.Message}", "GENERATION_FAILED"));
        }
    }


    // ── Video Quiz ────────────────────────────────────────────────────────

    [HttpGet("{id:guid}/quiz")]
    public async Task<IActionResult> GetVideoQuiz(Guid id, [FromQuery] string? difficulty, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var video = await GetVideoWithAccessCheckAsync(id, userId, cancellationToken);
        if (video is null)
            return NotFound(BaseResponse<IEnumerable<QuizDto>>.Fail("Video not found.", "VIDEO_NOT_FOUND"));

        var normalizedDifficulty = string.IsNullOrWhiteSpace(difficulty) ? null : QuizDifficulty.Normalize(difficulty);
        var ttl = TimeSpan.FromSeconds(_cacheOptions.GeneratedResultSeconds);
        var cacheKey = VideoQuizCacheKey(id, video.UserId, normalizedDifficulty ?? "all");

        var cached = await _cache.GetAsync<List<QuizDto>>(cacheKey, cancellationToken);
        if (cached != null)
            return Ok(BaseResponse<IEnumerable<QuizDto>>.Ok(cached));

        var quizzes = await _unitOfWork.Quizzes.FindAsync(
            q => q.YouTubeVideoId == id && q.UserId == video.UserId && (normalizedDifficulty == null || q.Difficulty == normalizedDifficulty),
            cancellationToken);
        var dtos = quizzes.Select(q => q.ToQuizDto()).ToList();
        if (dtos.Count > 0)
            await _cache.SetAsync(cacheKey, dtos, ttl, cancellationToken);
        return Ok(BaseResponse<IEnumerable<QuizDto>>.Ok(dtos));
    }

    [HttpPost("{id:guid}/quiz/generate")]
    public async Task<IActionResult> GenerateVideoQuiz(Guid id, [FromBody] YouTubeUrlRequest request, [FromQuery] string difficulty = "medium", CancellationToken cancellationToken = default)
    {
        var userId = User.GetUserId();
        var normalizedDifficulty = QuizDifficulty.Normalize(difficulty);
        var video = await GetVideoWithAccessCheckAsync(id, userId, cancellationToken);
        if (video is null)
            return NotFound(BaseResponse<IEnumerable<QuizDto>>.Fail("Video not found.", "VIDEO_NOT_FOUND"));

        // Return cached quiz if it already exists
        var existingQuizzes = (await _unitOfWork.Quizzes.FindAsync(q => q.YouTubeVideoId == id && q.UserId == userId && q.Difficulty == normalizedDifficulty, cancellationToken)).ToList();
        if (existingQuizzes.Count > 0)
            return Ok(BaseResponse<IEnumerable<QuizDto>>.Ok(existingQuizzes.Select(q => q.ToQuizDto())));

        // No cached data — fetch transcript and generate
        var transcript = await GetOrFetchTranscriptAsync(video, cancellationToken);
        if (transcript == null)
            return BadRequest(BaseResponse<IEnumerable<QuizDto>>.Fail("No subtitles available for this video.", "NO_TRANSCRIPT"));

        var resultJson = await _aiService.GenerateQuizFromYouTubeAsync(transcript, normalizedDifficulty, cancellationToken);

        List<AiQuizItem> quizItems;
        try
        {
            quizItems = JsonSerializer.Deserialize<List<AiQuizItem>>(resultJson,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? [];
        }
        catch
        {
            quizItems = [];
        }

        foreach (var item in quizItems)
        {
            await _unitOfWork.Quizzes.AddAsync(new Quiz
            {
                QuizId = Guid.NewGuid(),
                UserId = userId,
                YouTubeVideoId = id,
                SourceType = "video",
                Question = item.Question,
                OptionsJson = JsonSerializer.Serialize(item.Options),
                CorrectAnswer = item.CorrectAnswer,
                Explanation = item.Explanation,
                Difficulty = normalizedDifficulty,
                CreatedAt = DateTime.UtcNow
            }, cancellationToken);
        }
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        var saved = await _unitOfWork.Quizzes.FindAsync(q => q.YouTubeVideoId == id && q.UserId == userId && q.Difficulty == normalizedDifficulty, cancellationToken);
        var savedDtos = saved.Select(q => q.ToQuizDto()).ToList();
        await _cache.SetAsync(VideoQuizCacheKey(id, userId, normalizedDifficulty), savedDtos, TimeSpan.FromSeconds(_cacheOptions.GeneratedResultSeconds), cancellationToken);
        return Ok(BaseResponse<IEnumerable<QuizDto>>.Ok(savedDtos));
    }

    [HttpPost("{id:guid}/quiz/submit")]
    [ProducesResponseType(typeof(BaseResponse<QuizSubmissionDto>), 200)]
    public async Task<IActionResult> SubmitVideoQuiz(Guid id, [FromBody] SaveQuizSubmissionRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(
            new SaveVideoQuizSubmissionCommand(id, userId, request.Answers, request.Score, request.Total),
            cancellationToken);
        if (!result.IsSuccess)
            return NotFound(BaseResponse<QuizSubmissionDto>.Fail(result.Message, result.ErrorCode));
        return Ok(BaseResponse<QuizSubmissionDto>.Ok(result.Data!, result.Message));
    }

    [HttpGet("{id:guid}/quiz/submission")]
    [ProducesResponseType(typeof(BaseResponse<QuizSubmissionDto>), 200)]
    public async Task<IActionResult> GetVideoQuizSubmission(Guid id, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var submission = await _unitOfWork.QuizSubmissions.GetByVideoAndUserAsync(id, userId, cancellationToken);
        if (submission is null)
            return Ok(BaseResponse<QuizSubmissionDto?>.Ok(null));

        var dto = submission.ToQuizSubmissionDto();
        return Ok(BaseResponse<QuizSubmissionDto>.Ok(dto));
    }

}
