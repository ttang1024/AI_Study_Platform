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
    private readonly ICourseRepository _courses;
    private readonly IDocumentRepository _documents;
    private readonly IFlashcardRepository _flashcards;
    private readonly IVideoRepository _videos;
    private readonly IFlashcardSrsDataRepository _flashcardSrs;
    private readonly IAnkiExportService _ankiExport;

    public ExportFlashcardsToAnkiQueryHandler(ICourseRepository courses, IDocumentRepository documents, IFlashcardRepository flashcards, IVideoRepository videos, IFlashcardSrsDataRepository flashcardSrs, IAnkiExportService ankiExport)
    {
        _courses = courses;
        _documents = documents;
        _flashcards = flashcards;
        _videos = videos;
        _flashcardSrs = flashcardSrs;
        _ankiExport = ankiExport;
    }

    public async Task<Result<AnkiPackageDto>> Handle(ExportFlashcardsToAnkiQuery request, CancellationToken ct)
    {
        var flashcards = (await _flashcards.GetByUserIdAsync(request.UserId, ct)).ToList();
        var deckName = "Study Platform";

        if (request.CourseId.HasValue)
        {
            var course = await _courses.GetOwnedAsync(request.CourseId.Value, request.UserId, ct);
            if (course == null)
                return Result<AnkiPackageDto>.Failure("Course not found.", "COURSE_NOT_FOUND");
            deckName = course.CourseName;

            // The attribution maps, not the rows: this only needs to know which source belongs to the
            // course, and materialising the documents and videos to find out drags their text along.
            var docToCourse = await _documents.GetDocumentCourseMapAsync(request.UserId, ct);
            var videoToCourse = await _videos.GetVideoCourseMapAsync(request.UserId, ct);

            bool InCourse(Guid? documentId, Guid? videoId)
                => (documentId.HasValue && docToCourse.TryGetValue(documentId.Value, out var docCourse) && docCourse == request.CourseId.Value)
                   || (videoId.HasValue && videoToCourse.TryGetValue(videoId.Value, out var videoCourse) && videoCourse == request.CourseId.Value);

            flashcards = flashcards.Where(f => InCourse(f.DocumentId, f.VideoId)).ToList();
        }

        if (flashcards.Count == 0)
            return Result<AnkiPackageDto>.Failure("No flashcards to export.", "NO_FLASHCARDS");

        var srsMap = (await _flashcardSrs.GetByUserIdAsync(request.UserId, ct))
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
