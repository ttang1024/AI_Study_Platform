using System.Linq.Expressions;
using Moq;
using StudyPlatform.Application.Documents;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Documents;

public class StudyMaterialLookupTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<ICourseRepository> _courses = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<IVideoRepository> _videos = new();
    private readonly StudyMaterialLookup _lookup;

    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _courseId = Guid.NewGuid();

    public StudyMaterialLookupTests()
    {
        _uow.Setup(u => u.Courses).Returns(_courses.Object);
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _uow.Setup(u => u.Videos).Returns(_videos.Object);
        Courses();
        Documents();
        Videos();
        _lookup = new StudyMaterialLookup(_uow.Object);
    }

    private void Courses(params Course[] courses) =>
        _courses.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Course, bool>>>(), default))
            .ReturnsAsync(courses);

    /// <summary>Applies the predicate the lookup passes down, so filtering is actually exercised.</summary>
    private void Documents(params Document[] documents) =>
        _documents.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Document, bool>>>(), default))
            .ReturnsAsync((Expression<Func<Document, bool>> p, CancellationToken _) =>
                documents.Where(p.Compile()).ToList());

    private void Videos(params Video[] videos) =>
        _videos.Setup(r => r.FindAsNoTrackingAsync(It.IsAny<Expression<Func<Video, bool>>>(), default))
            .ReturnsAsync((Expression<Func<Video, bool>> p, CancellationToken _) =>
                videos.Where(p.Compile()).ToList());

    private Document Doc(Guid id, DateTime? createdAt = null, Guid? courseId = null) => new()
    {
        DocumentId = id,
        UserId = _userId,
        CourseId = courseId ?? _courseId,
        FileName = "Doc.pdf",
        ContentType = "application/pdf",
        CreatedAt = createdAt ?? DateTime.UtcNow,
    };

    private Video Vid(Guid id, DateTime? createdAt = null) => new()
    {
        VideoId = id,
        UserId = _userId,
        CourseId = _courseId,
        Title = "Lecture",
        ExternalVideoId = "abc",
        SourceType = "youtube",
        CreatedAt = createdAt ?? DateTime.UtcNow,
    };

    [Fact]
    public async Task ListUncoveredAsync_OmitsMaterialsWhoseIdsAreCovered()
    {
        var covered = Guid.NewGuid();
        var pending = Guid.NewGuid();
        var coveredVideo = Guid.NewGuid();
        var pendingVideo = Guid.NewGuid();
        Documents(Doc(covered), Doc(pending));
        Videos(Vid(coveredVideo), Vid(pendingVideo));

        var result = await _lookup.ListUncoveredAsync(_userId, [covered], [coveredVideo]);

        var ids = result.Select(m => m.Id).ToHashSet();
        Assert.Equal(new HashSet<Guid> { pending, pendingVideo }, ids);
    }

    [Fact]
    public async Task ListSelectedAsync_KeepsOnlyTheRequestedIds()
    {
        var wanted = Guid.NewGuid();
        var other = Guid.NewGuid();
        Documents(Doc(wanted), Doc(other));

        var result = await _lookup.ListSelectedAsync(_userId, new HashSet<Guid> { wanted }, new HashSet<Guid>());

        Assert.Equal(wanted, Assert.Single(result).Id);
    }

    [Fact]
    public async Task ListAsync_ScopesEveryQueryToTheUser()
    {
        var mine = Doc(Guid.NewGuid());
        var theirs = Doc(Guid.NewGuid());
        theirs.UserId = Guid.NewGuid();
        Documents(mine, theirs);

        var result = await _lookup.ListUncoveredAsync(_userId, [], []);

        Assert.Equal(mine.DocumentId, Assert.Single(result).Id);
    }

    [Fact]
    public async Task ListAsync_ReturnsNewestFirstAcrossBothKinds()
    {
        var old = Guid.NewGuid();
        var newest = Guid.NewGuid();
        var middle = Guid.NewGuid();
        Documents(Doc(old, new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)));
        Videos(
            Vid(newest, new DateTime(2026, 3, 1, 0, 0, 0, DateTimeKind.Utc)),
            Vid(middle, new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc)));

        var result = (await _lookup.ListUncoveredAsync(_userId, [], [])).ToList();

        Assert.Equal([newest, middle, old], result.Select(m => m.Id));
    }

    [Fact]
    public async Task ListAsync_AnnotatesMaterialsWithTheirCourse()
    {
        Courses(new Course { CourseId = _courseId, UserId = _userId, CourseName = "Physics", CourseColor = "#ff0000" });
        Documents(Doc(Guid.NewGuid()));

        var material = Assert.Single(await _lookup.ListUncoveredAsync(_userId, [], []));

        Assert.Equal("Physics", material.CourseName);
        Assert.Equal("#ff0000", material.CourseColor);
    }

    [Fact]
    public async Task ListAsync_MaterialInAnUnknownCourse_FallsBackToNeutralAnnotation()
    {
        Documents(Doc(Guid.NewGuid(), courseId: Guid.NewGuid()));

        var material = Assert.Single(await _lookup.ListUncoveredAsync(_userId, [], []));

        Assert.Equal(string.Empty, material.CourseName);
        Assert.Equal("#a1a1aa", material.CourseColor);
    }

    [Fact]
    public async Task ListAsync_ProjectsTheTwoKindsOntoTheirOwnFields()
    {
        Documents(Doc(Guid.NewGuid()));
        Videos(Vid(Guid.NewGuid()));

        var result = (await _lookup.ListUncoveredAsync(_userId, [], [])).ToList();

        var document = Assert.Single(result, m => m.Kind == "document");
        Assert.Equal("Doc.pdf", document.Name);
        Assert.Equal("application/pdf", document.ContentType);
        Assert.Null(document.VideoId);

        var video = Assert.Single(result, m => m.Kind == "video");
        Assert.Equal("Lecture", video.Name);
        Assert.Equal("abc", video.VideoId);
        Assert.Equal("youtube", video.SourceType);
        Assert.Null(video.ContentType);
    }

    [Fact]
    public async Task ListAsync_ReadsWithoutChangeTracking()
    {
        await _lookup.ListUncoveredAsync(_userId, [], []);

        // These rows are projected to DTOs and never saved; tracking a document's full transcript
        // is pure overhead.
        _documents.Verify(r => r.FindAsync(It.IsAny<Expression<Func<Document, bool>>>(), default), Times.Never);
        _videos.Verify(r => r.FindAsync(It.IsAny<Expression<Func<Video, bool>>>(), default), Times.Never);
        _courses.Verify(r => r.FindAsync(It.IsAny<Expression<Func<Course, bool>>>(), default), Times.Never);
    }
}
