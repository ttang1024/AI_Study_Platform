using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Language;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.API.Controllers;

/// <summary>
/// Language-learning practice: speaking a phrase and having it checked, and turning a sentence you
/// met while reading into a card that enters the ordinary review schedule.
/// </summary>
[ApiController]
[Route("api/language")]
[Authorize]
[Produces("application/json")]
public class LanguageController : ControllerBase
{
    private readonly ITranscriptionService _transcription;
    private readonly IUnitOfWork _unitOfWork;

    public LanguageController(
        ITranscriptionService transcription, IUnitOfWork unitOfWork)
    {
        _transcription = transcription;
        _unitOfWork = unitOfWork;
    }

    public record MineSentenceRequest(
        string Sentence, string TargetWord, string? Meaning, Guid? DocumentId, Guid? VideoId);

    /// <summary>
    /// Scores a recorded attempt at a phrase.
    ///
    /// The audio is transcribed and compared to the target; nothing is stored. A recording of
    /// someone's voice is not something to keep by default, and the score is the only part with any
    /// lasting value.
    /// </summary>
    [HttpPost("pronunciation")]
    [RequestSizeLimit(10_485_760)] // 10MB — a spoken phrase, not a lecture
    [ProducesResponseType(typeof(BaseResponse<PronunciationResult>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> ScorePronunciation(
        IFormFile audio, [FromForm] string targetPhrase, CancellationToken cancellationToken)
    {
        if (audio == null || audio.Length == 0)
            return BadRequest(BaseResponse<PronunciationResult>.Fail("No recording supplied.", "NO_AUDIO"));

        if (string.IsNullOrWhiteSpace(targetPhrase))
            return BadRequest(BaseResponse<PronunciationResult>.Fail("No target phrase supplied.", "NO_PHRASE"));

        await using var stream = audio.OpenReadStream();
        using var buffer = new MemoryStream();
        await stream.CopyToAsync(buffer, cancellationToken);

        var heard = await _transcription.TranscribeAsync(
            buffer.ToArray(), audio.ContentType, cancellationToken);

        var result = PronunciationScorer.Score(targetPhrase, heard ?? string.Empty);

        return Ok(BaseResponse<PronunciationResult>.Ok(result));
    }

    /// <summary>
    /// Turns a sentence into a cloze card with the target word blanked.
    ///
    /// Sentence mining produces an ordinary flashcard rather than anything language-specific, so it
    /// inherits FSRS scheduling, offline caching and the existing review UI for free — the value is
    /// in meeting the word in the sentence it was found in, not in a separate subsystem.
    /// </summary>
    [HttpPost("mine")]
    [ProducesResponseType(typeof(BaseResponse<Guid>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    public async Task<IActionResult> MineSentence(
        [FromBody] MineSentenceRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Sentence) || string.IsNullOrWhiteSpace(request.TargetWord))
            return BadRequest(BaseResponse<Guid>.Fail("A sentence and a target word are required.", "INVALID"));

        var cloze = SentenceMiner.BuildCloze(request.Sentence, request.TargetWord);
        if (cloze == null)
            return BadRequest(BaseResponse<Guid>.Fail(
                "That word does not appear in the sentence.", "WORD_NOT_IN_SENTENCE"));

        var now = DateTime.UtcNow;
        var card = new Flashcard
        {
            FlashcardId = Guid.NewGuid(),
            UserId = User.GetUserId(),
            DocumentId = request.DocumentId,
            VideoId = request.VideoId,
            SourceType = request.VideoId != null ? "video" : "document",
            Front = cloze,
            // The back carries the meaning when given, and the answer otherwise — a cloze card with
            // an empty back gives the learner nothing to check themselves against.
            Back = string.IsNullOrWhiteSpace(request.Meaning) ? request.TargetWord : request.Meaning!,
            CardType = "cloze",
            CreatedAt = now,
            UpdatedAt = now,
        };

        await _unitOfWork.Flashcards.AddAsync(card, cancellationToken);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        return Ok(BaseResponse<Guid>.Ok(card.FlashcardId, "Card added to your reviews."));
    }
}
