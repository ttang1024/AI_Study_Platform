using Moq;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Domain.Projections;

namespace StudyPlatform.Tests.TestSupport;

/// <summary>Serves <c>GetSourceCoursesByUserAsync</c> from entity fixtures, as the repository projects them.</summary>
public static class SourceCourseStubs
{
    public static void WithSources(this Mock<IDocumentRepository> mock, IEnumerable<Document> documents)
        => mock.Setup(r => r.GetSourceCoursesByUserAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(documents.Select(d => new SourceCourse(d.DocumentId, d.CourseId, d.FileName)).ToList());

    public static void WithSources(this Mock<IVideoRepository> mock, IEnumerable<Video> videos)
        => mock.Setup(r => r.GetSourceCoursesByUserAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(videos.Select(v => new SourceCourse(v.VideoId, v.CourseId, v.Title)).ToList());
}
