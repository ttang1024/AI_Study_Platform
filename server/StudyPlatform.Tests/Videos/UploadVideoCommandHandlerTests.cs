using System.Linq.Expressions;
using Microsoft.Extensions.Options;
using Moq;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.Settings;
using StudyPlatform.Application.Videos.Commands;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Videos;

/// <summary>The upload logic that used to live in VideoController, untested there.</summary>
public class UploadVideoCommandHandlerTests
{
    private readonly Mock<ICourseRepository> _courses = new();
    private readonly Mock<IVideoRepository> _videos = new();
    private readonly Mock<IBlobStorageService> _blobs = new();
    private readonly Mock<IStoredFileCleanup> _storedFiles = new();
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _courseId = Guid.NewGuid();

    public UploadVideoCommandHandlerTests()
    {
        _courses.Setup(r => r.GetByIdAsync(_courseId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Course { CourseId = _courseId, UserId = _userId, CourseName = "C" });
        _blobs.Setup(b => b.UploadAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Stream _, string name, string _, CancellationToken _) => $"blob://{name}");
        _videos.Setup(r => r.AddUploadWithinLimitAsync(It.IsAny<Video>(), It.IsAny<int>(), It.IsAny<CancellationToken>())).ReturnsAsync(true);
        _videos.Setup(r => r.GetByIdForUserAsync(It.IsAny<Guid>(), _userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Guid id, Guid _, CancellationToken _) => new Video { VideoId = id, UserId = _userId, CourseId = _courseId, Course = new Course { CourseName = "C" }, SourceType = "upload" });
    }

    private UploadVideoCommandHandler Handler(int limit = -1) => new(
        _courses.Object, _videos.Object, _blobs.Object, _storedFiles.Object,
        Options.Create(new AppLimitsOptions { VideoUploadLimit = limit }));

    private UploadVideoCommand Command(string name = "lecture.mp4", string type = "video/mp4", Guid? courseId = null) => new(
        _userId, courseId ?? _courseId, new UploadedFile(new MemoryStream([1]), name, type, 1), null);

    [Fact]
    public async Task ValidUpload_IsStoredAndRecordedPendingTranscription()
    {
        Video? recorded = null;
        _videos.Setup(r => r.AddUploadWithinLimitAsync(It.IsAny<Video>(), -1, It.IsAny<CancellationToken>()))
            .Callback((Video v, int _, CancellationToken _) => recorded = v).ReturnsAsync(true);

        var result = await Handler().Handle(Command("My Lecture!.mp4"), default);

        Assert.True(result.IsSuccess);
        Assert.NotNull(recorded!.TranscriptionRequestedAt);
        Assert.Equal("My Lecture!", recorded.Title);
        // The blob key carries a sanitised copy of the client's file name, never the raw one.
        Assert.Matches($"^blob://{_userId}/{_courseId}/videos/[0-9a-f-]+_My_Lecture_.mp4$", recorded.VideoUrl);
    }

    [Fact]
    public async Task NonVideoFile_IsRejectedBeforeAnythingIsStored()
    {
        var result = await Handler().Handle(Command("notes.html", "text/html"), default);

        Assert.Equal("INVALID_FILE_TYPE", result.ErrorCode);
        _blobs.Verify(b => b.UploadAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task SomeoneElsesCourse_IsNotFound()
    {
        var result = await Handler().Handle(Command(courseId: Guid.NewGuid()), default);

        Assert.Equal("COURSE_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task LosingTheAtomicLimitCheck_DeletesTheStoredFile()
    {
        // Passed the early count, then a parallel upload took the last slot first.
        _videos.Setup(r => r.CountAsync(It.IsAny<Expression<Func<Video, bool>>>(), It.IsAny<CancellationToken>())).ReturnsAsync(2);
        _videos.Setup(r => r.AddUploadWithinLimitAsync(It.IsAny<Video>(), 3, It.IsAny<CancellationToken>())).ReturnsAsync(false);

        var result = await Handler(limit: 3).Handle(Command(), default);

        Assert.Equal("VIDEO_LIMIT_REACHED", result.ErrorCode);
        _storedFiles.Verify(s => s.DeleteAsync(It.Is<IEnumerable<string?>>(u => u.Any(x => x != null && x.EndsWith(".mp4"))), It.IsAny<CancellationToken>()), Times.Once);
    }
}
