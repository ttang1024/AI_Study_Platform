using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.API.Extensions;
using StudyPlatform.API.Services;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.Commands;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Application.Documents.Queries;
using StudyPlatform.Application.Services;

namespace StudyPlatform.API.Controllers;

[ApiController]
[Route("api/courses/{courseId:guid}/audio")]
[Authorize]
[Produces("application/json")]
public class AudioController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly IBlobStorageService _blobStorage;
    private readonly AudioTranscriptionQueue _transcriptionQueue;

    public AudioController(
        IMediator mediator,
        IBlobStorageService blobStorage,
        AudioTranscriptionQueue transcriptionQueue)
    {
        _mediator = mediator;
        _blobStorage = blobStorage;
        _transcriptionQueue = transcriptionQueue;
    }

    private static readonly string[] AllowedMimeTypes =
    [
        "audio/mpeg", "audio/mp3", "audio/mp4", "audio/x-m4a",
        "audio/wav", "audio/x-wav", "audio/ogg", "audio/aac",
        "audio/flac", "audio/webm", "audio/opus",
        "audio/aiff", "audio/x-aiff", "audio/x-ms-wma", "audio/amr", "audio/3gpp",
        "audio/x-m4b", "audio/x-matroska"
    ];

    private static readonly string[] AllowedExtensions =
        [".mp3", ".m4a", ".m4b", ".wav", ".ogg", ".aac", ".flac", ".opus", ".aiff", ".aif", ".wma", ".amr", ".mka"];

    // Browsers often report an empty or generic content type for the less
    // common audio formats; downstream logic (transcription, content service)
    // keys off an audio/* type, so normalise from the extension when needed.
    private static string NormalizeAudioContentType(string contentType, string ext)
    {
        if (!string.IsNullOrWhiteSpace(contentType) &&
            contentType.StartsWith("audio/", StringComparison.OrdinalIgnoreCase))
            return contentType;

        return ext switch
        {
            ".mp3" => "audio/mpeg",
            ".m4a" => "audio/x-m4a",
            ".m4b" => "audio/mp4",
            ".mka" => "audio/x-matroska",
            ".wav" => "audio/wav",
            ".ogg" => "audio/ogg",
            ".aac" => "audio/aac",
            ".flac" => "audio/flac",
            ".opus" => "audio/opus",
            ".aiff" or ".aif" => "audio/aiff",
            ".wma" => "audio/x-ms-wma",
            ".amr" => "audio/amr",
            _ => "audio/mpeg",
        };
    }

    /// <summary>
    /// Upload an audio lecture to a course
    /// </summary>
    [HttpPost("upload")]
    [ProducesResponseType(typeof(BaseResponse<DocumentDto>), 201)]
    [ProducesResponseType(typeof(BaseResponse), 400)]
    [RequestSizeLimit(104857600)] // 100 MB
    public async Task<IActionResult> UploadAudio(Guid courseId, IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest(BaseResponse<DocumentDto>.Fail("No file provided.", "NO_FILE"));

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();

        if (!AllowedMimeTypes.Contains(file.ContentType) && !AllowedExtensions.Contains(ext))
            return BadRequest(BaseResponse<DocumentDto>.Fail(
                "File type not supported. Allowed: MP3, M4A/M4B, WAV, OGG, AAC, FLAC, OPUS, AIFF, WMA, AMR, MKA.",
                "INVALID_FILE_TYPE"));

        var userId = User.GetUserId();
        using var stream = file.OpenReadStream();
        var result = await _mediator.Send(new UploadDocumentCommand(
            courseId, userId, file.FileName, NormalizeAudioContentType(file.ContentType, ext), file.Length, stream));

        if (!result.IsSuccess)
        {
            if (result.ErrorCode == "STORAGE_ERROR")
                return StatusCode(StatusCodes.Status503ServiceUnavailable, BaseResponse<DocumentDto>.Fail(result.Message, result.ErrorCode));
            if (result.ErrorCode == "DUPLICATE_DOCUMENT")
                return Conflict(BaseResponse<DocumentDto>.Fail(result.Message, result.ErrorCode));

            return BadRequest(BaseResponse<DocumentDto>.Fail(result.Message, result.ErrorCode));
        }

        return StatusCode(201, BaseResponse<DocumentDto>.Ok(result.Data!, result.Message));
    }

    /// <summary>
    /// Get an audio document by ID
    /// </summary>
    [HttpGet("{documentId:guid}")]
    [ProducesResponseType(typeof(BaseResponse<DocumentDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> GetAudio(Guid courseId, Guid documentId)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetDocumentByIdQuery(documentId, userId));
        if (!result.IsSuccess)
            return NotFound(BaseResponse<DocumentDto>.Fail(result.Message, result.ErrorCode));

        return Ok(BaseResponse<DocumentDto>.Ok(result.Data!));
    }

    /// <summary>
    /// Get a short-lived SAS URL for audio playback.
    /// For podcast episodes the direct URL is returned as-is (no SAS needed).
    /// </summary>
    [HttpGet("{documentId:guid}/url")]
    [ProducesResponseType(typeof(BaseResponse<string>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> GetAudioUrl(Guid courseId, Guid documentId)
    {
        var userId = User.GetUserId();
        var result = await _mediator.Send(new GetDocumentByIdQuery(documentId, userId));
        if (!result.IsSuccess)
            return NotFound(BaseResponse<string>.Fail(result.Message, result.ErrorCode));

        // Podcasts store a direct HTTP URL — no blob SAS needed
        if (result.Data!.ContentType == "audio/podcast")
            return Ok(BaseResponse<string>.Ok(result.Data.BlobUrl));

        var sasUrl = await _blobStorage.GetSasUrlAsync(result.Data!.BlobUrl, expiryMinutes: 60);
        return Ok(BaseResponse<string>.Ok(sasUrl));
    }

    /// <summary>
    /// Transcribe the audio file using AI.
    /// Podcast episodes are downloaded from their direct URL; uploaded files from blob storage.
    /// </summary>
    [HttpPost("{documentId:guid}/transcribe")]
    [ProducesResponseType(typeof(BaseResponse<DocumentDto>), 200)]
    [ProducesResponseType(typeof(BaseResponse), 404)]
    public async Task<IActionResult> TranscribeAudio(Guid courseId, Guid documentId)
    {
        var userId = User.GetUserId();

        var docResult = await _mediator.Send(new GetDocumentByIdQuery(documentId, userId));
        if (!docResult.IsSuccess)
            return NotFound(BaseResponse<DocumentDto>.Fail(docResult.Message, docResult.ErrorCode));

        if (!string.IsNullOrWhiteSpace(docResult.Data!.Transcript))
            return Ok(BaseResponse<DocumentDto>.Ok(docResult.Data, "Audio already transcribed."));

        var isPodcast = docResult.Data.ContentType == "audio/podcast";
        _transcriptionQueue.TryEnqueue(documentId, userId, isPodcast);

        return Accepted(BaseResponse<DocumentDto>.Ok(docResult.Data, "Audio transcription started."));
    }
}
