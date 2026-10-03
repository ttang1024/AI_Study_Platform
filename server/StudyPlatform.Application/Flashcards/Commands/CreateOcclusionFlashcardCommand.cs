using System.Text.Json;
using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents.DTOs;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Flashcards.Commands;

/// <summary>One normalized (0–1) mask rectangle drawn over the occlusion image.</summary>
public record OcclusionRect(double X, double Y, double W, double H, string? Label = null);

/// <summary>
/// Creates an image-occlusion flashcard: an uploaded image with masked regions.
/// Review shows the image with all masks opaque; the flip reveals them.
/// </summary>
public record CreateOcclusionFlashcardCommand(
    Guid UserId,
    Stream Image,
    string FileName,
    string ContentType,
    string Front,
    string Back,
    string OcclusionsJson,
    Guid? DocumentId = null) : IRequest<Result<FlashcardDto>>;

public class CreateOcclusionFlashcardCommandHandler : IRequestHandler<CreateOcclusionFlashcardCommand, Result<FlashcardDto>>
{
    private const int MaxOcclusions = 50;
    private static readonly string[] AllowedContentTypes = ["image/png", "image/jpeg", "image/webp", "image/gif"];

    private readonly IUnitOfWork _unitOfWork;
    private readonly IBlobStorageService _blobStorage;

    public CreateOcclusionFlashcardCommandHandler(IUnitOfWork unitOfWork, IBlobStorageService blobStorage)
    {
        _unitOfWork = unitOfWork;
        _blobStorage = blobStorage;
    }

    public async Task<Result<FlashcardDto>> Handle(CreateOcclusionFlashcardCommand request, CancellationToken ct)
    {
        if (!AllowedContentTypes.Contains(request.ContentType, StringComparer.OrdinalIgnoreCase))
            return Result<FlashcardDto>.Failure("Image must be PNG, JPEG, WebP or GIF.", "UNSUPPORTED_IMAGE");

        List<OcclusionRect>? rects;
        try
        {
            rects = JsonSerializer.Deserialize<List<OcclusionRect>>(request.OcclusionsJson,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        }
        catch (JsonException)
        {
            return Result<FlashcardDto>.Failure("Occlusions must be a JSON array of rectangles.", "INVALID_OCCLUSIONS");
        }

        if (rects == null || rects.Count == 0)
            return Result<FlashcardDto>.Failure("Draw at least one mask over the image.", "NO_OCCLUSIONS");
        if (rects.Count > MaxOcclusions)
            return Result<FlashcardDto>.Failure($"At most {MaxOcclusions} masks per card.", "TOO_MANY_OCCLUSIONS");
        if (rects.Any(r => r.X is < 0 or > 1 || r.Y is < 0 or > 1 || r.W is <= 0 or > 1 || r.H is <= 0 or > 1))
            return Result<FlashcardDto>.Failure("Mask coordinates must be normalized to 0–1.", "INVALID_OCCLUSIONS");

        if (request.DocumentId.HasValue)
        {
            var doc = await _unitOfWork.Documents.GetByIdAsync(request.DocumentId.Value, ct);
            if (doc == null || doc.UserId != request.UserId)
                return Result<FlashcardDto>.Failure("Document not found.", "DOCUMENT_NOT_FOUND");
        }

        var extension = Path.GetExtension(request.FileName);
        if (string.IsNullOrEmpty(extension))
            extension = request.ContentType.ToLowerInvariant() switch
            {
                "image/png" => ".png",
                "image/webp" => ".webp",
                "image/gif" => ".gif",
                _ => ".jpg",
            };
        var blobName = $"occlusions/{request.UserId:N}/{Guid.NewGuid():N}{extension}";
        var imageUrl = await _blobStorage.UploadAsync(request.Image, blobName, request.ContentType, ct);

        // Re-serialize the validated rects so we never store attacker-shaped JSON.
        var normalizedJson = JsonSerializer.Serialize(rects.Select(r => new
        {
            x = Math.Round(r.X, 4),
            y = Math.Round(r.Y, 4),
            w = Math.Round(r.W, 4),
            h = Math.Round(r.H, 4),
            label = string.IsNullOrWhiteSpace(r.Label) ? null : r.Label.Trim(),
        }));

        var flashcard = new Flashcard
        {
            FlashcardId = Guid.NewGuid(),
            DocumentId = request.DocumentId,
            SourceType = "document",
            UserId = request.UserId,
            Front = string.IsNullOrWhiteSpace(request.Front) ? "Identify the hidden parts" : request.Front.Trim(),
            Back = request.Back?.Trim() ?? string.Empty,
            CardType = "occlusion",
            ImageUrl = imageUrl,
            OcclusionsJson = normalizedJson,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        await _unitOfWork.Flashcards.AddAsync(flashcard, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        return Result<FlashcardDto>.Success(flashcard.ToFlashcardDto(), "Occlusion card created.");
    }
}
