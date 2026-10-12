using StudyPlatform.Application.Videos.Transcripts;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Application.Notes.DTOs;
using StudyPlatform.Application.Videos.Commands;

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

        var flashcards = await _flashcards.FindAsync(f => f.VideoId == id && f.UserId == video.UserId, cancellationToken);
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

        var notes = await _notes.FindAsync(n => n.VideoId == id && n.UserId == video.UserId, cancellationToken);
        var dtos = notes
            .OrderByDescending(n => n.CreatedAt)
            .Select(n => n.ToNoteDto());
        return Ok(BaseResponse<IEnumerable<NoteDto>>.Ok(dtos));
    }

    [HttpPost("{id:guid}/flashcards/generate")]
    public async Task<IActionResult> GenerateVideoFlashcards(Guid id, CancellationToken cancellationToken)
        => ToResponse(await _mediator.Send(new GenerateVideoFlashcardsCommand(id, User.GetUserId()), cancellationToken));

    // ── Video Glossary ────────────────────────────────────────────────────

    [HttpGet("{id:guid}/glossary")]
    public async Task<IActionResult> GetVideoGlossary(Guid id, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var ttl = TimeSpan.FromSeconds(_cacheOptions.GeneratedResultSeconds);
        var cacheKey = VideoCacheKeys.Glossary(id, userId);

        var cached = await _cache.GetAsync<List<GlossaryTermDto>>(cacheKey, cancellationToken);
        if (cached != null)
            return Ok(BaseResponse<IEnumerable<GlossaryTermDto>>.Ok(cached));

        var terms = await _glossaryTerms.GetByVideoIdAsync(id, cancellationToken);
        var dtos = terms.Where(t => t.UserId == userId)
            .Select(t => t.ToGlossaryTermDto())
            .ToList();
        if (dtos.Count > 0)
            await _cache.SetAsync(cacheKey, dtos, ttl, cancellationToken);
        return Ok(BaseResponse<IEnumerable<GlossaryTermDto>>.Ok(dtos));
    }

    [HttpPost("{id:guid}/glossary/generate")]
    public async Task<IActionResult> GenerateVideoGlossary(Guid id, CancellationToken cancellationToken)
        => ToResponse(await _mediator.Send(new GenerateVideoGlossaryCommand(id, User.GetUserId()), cancellationToken));


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
        var cacheKey = VideoCacheKeys.Quiz(id, video.UserId, normalizedDifficulty ?? "all");

        var cached = await _cache.GetAsync<List<QuizDto>>(cacheKey, cancellationToken);
        if (cached != null)
            return Ok(BaseResponse<IEnumerable<QuizDto>>.Ok(cached));

        var quizzes = await _quizzes.FindAsync(
            q => q.VideoId == id && q.UserId == video.UserId && (normalizedDifficulty == null || q.Difficulty == normalizedDifficulty),
            cancellationToken);
        var dtos = quizzes.Select(q => q.ToQuizDto()).ToList();
        if (dtos.Count > 0)
            await _cache.SetAsync(cacheKey, dtos, ttl, cancellationToken);
        return Ok(BaseResponse<IEnumerable<QuizDto>>.Ok(dtos));
    }

    [HttpPost("{id:guid}/quiz/generate")]
    public async Task<IActionResult> GenerateVideoQuiz(Guid id, [FromQuery] string difficulty = "medium", CancellationToken cancellationToken = default)
        => ToResponse(await _mediator.Send(new GenerateVideoQuizCommand(id, User.GetUserId(), difficulty), cancellationToken));

    /// <summary>A generate command's result: 404 for a video the caller can't see, 400 for any other failure.</summary>
    private IActionResult ToResponse<T>(Result<T> result)
    {
        if (result.IsSuccess)
            return Ok(BaseResponse<T>.Ok(result.Data!, result.Message));
        var body = BaseResponse<T>.Fail(result.Message, result.ErrorCode);
        return result.ErrorCode == "VIDEO_NOT_FOUND" ? NotFound(body) : BadRequest(body);
    }

    [HttpPost("{id:guid}/quiz/submit")]
    [ProducesResponseType(typeof(BaseResponse<QuizSubmissionDto>), 200)]
    public async Task<IActionResult> SubmitVideoQuiz(Guid id, [FromBody] SaveQuizSubmissionRequest request, CancellationToken cancellationToken)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(
            new SaveVideoQuizSubmissionCommand(id, userId, request.Answers, request.Score, request.Total, request.Confidence),
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
        var submission = await _quizSubmissions.GetByVideoAndUserAsync(id, userId, cancellationToken);
        if (submission is null)
            return Ok(BaseResponse<QuizSubmissionDto?>.Ok(null));

        var dto = submission.ToQuizSubmissionDto();
        return Ok(BaseResponse<QuizSubmissionDto>.Ok(dto));
    }

}
