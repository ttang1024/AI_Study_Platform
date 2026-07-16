using MediatR;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Interfaces;

namespace StudyPlatform.Application.Flashcards.Commands;

public record AnkiPackageDto(byte[] Bytes, string FileName, int CardCount);

/// <summary>Exports the user's flashcards (optionally one course) as an Anki .apkg with scheduling state.</summary>
public record ExportFlashcardsToAnkiQuery(Guid UserId, Guid? CourseId = null) : IRequest<Result<AnkiPackageDto>>;

public class ExportFlashcardsToAnkiQueryHandler : IRequestHandler<ExportFlashcardsToAnkiQuery, Result<AnkiPackageDto>>
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAnkiExportService _ankiExport;

    public ExportFlashcardsToAnkiQueryHandler(IUnitOfWork unitOfWork, IAnkiExportService ankiExport)
    {
        _unitOfWork = unitOfWork;
        _ankiExport = ankiExport;
    }

    public async Task<Result<AnkiPackageDto>> Handle(ExportFlashcardsToAnkiQuery request, CancellationToken ct)
    {
        var flashcards = (await _unitOfWork.Flashcards.GetByUserIdAsync(request.UserId, ct)).ToList();
        var deckName = "Study Platform";

        if (request.CourseId.HasValue)
        {
            var course = await _unitOfWork.Courses.GetByIdAsync(request.CourseId.Value, ct);
            if (course == null || course.UserId != request.UserId)
                return Result<AnkiPackageDto>.Failure("Course not found.", "COURSE_NOT_FOUND");
            deckName = course.CourseName;

            var courseDocIds = (await _unitOfWork.Documents.FindAsNoTrackingAsync(
                d => d.UserId == request.UserId && d.CourseId == request.CourseId.Value, ct))
                .Select(d => d.DocumentId).ToHashSet();
            var courseVideoIds = (await _unitOfWork.Videos.FindAsNoTrackingAsync(
                v => v.UserId == request.UserId && v.CourseId == request.CourseId.Value, ct))
                .Select(v => v.VideoId).ToHashSet();

            flashcards = flashcards
                .Where(f => (f.DocumentId.HasValue && courseDocIds.Contains(f.DocumentId.Value))
                         || (f.VideoId.HasValue && courseVideoIds.Contains(f.VideoId.Value)))
                .ToList();
        }

        if (flashcards.Count == 0)
            return Result<AnkiPackageDto>.Failure("No flashcards to export.", "NO_FLASHCARDS");

        var srsMap = (await _unitOfWork.FlashcardSrs.GetByUserIdAsync(request.UserId, ct))
            .ToDictionary(s => s.FlashcardId);

        var cards = flashcards.Select(f =>
        {
            var srs = srsMap.GetValueOrDefault(f.FlashcardId);
            // Occlusion cards export their image; Anki renders remote <img> URLs when online.
            var front = f.CardType == "occlusion" && !string.IsNullOrEmpty(f.ImageUrl)
                ? $"<img src=\"{f.ImageUrl}\"><br>{f.Front}"
                : f.Front;
            return new AnkiExportCard(
                f.FlashcardId, front, f.Back, f.Tags,
                srs?.State, srs?.ScheduledDays, srs?.Reps, srs?.Lapses, srs?.Due);
        }).ToList();

        var bytes = _ankiExport.BuildPackage(deckName, cards);
        var safeName = string.Join("_", deckName.Split(Path.GetInvalidFileNameChars(), StringSplitOptions.RemoveEmptyEntries));
        return Result<AnkiPackageDto>.Success(new AnkiPackageDto(bytes, $"{safeName}.apkg", cards.Count));
    }
}
