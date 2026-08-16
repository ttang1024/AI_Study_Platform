using System.Linq.Expressions;
using Microsoft.Extensions.Options;
using Moq;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.Settings;
using StudyPlatform.Application.Videos.Commands;
using StudyPlatform.Application.Videos.Queries;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Domain.Projections;
using Xunit;

namespace StudyPlatform.Tests.Videos;

public class SaveVideoCommandHandlerAdditionalTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IVideoRepository> _videos = new();
    private readonly Mock<IFlashcardRepository> _flashcards = new();
    private readonly Mock<IQuizRepository> _quizzes = new();
    private readonly SaveVideoCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _courseId = Guid.NewGuid();

    public SaveVideoCommandHandlerAdditionalTests()
    {
        _uow.Setup(u => u.Videos).Returns(_videos.Object);
        _uow.Setup(u => u.Flashcards).Returns(_flashcards.Object);
        _uow.Setup(u => u.Quizzes).Returns(_quizzes.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _videos.Setup(r => r.FindAsync(It.IsAny<Expression<Func<Video, bool>>>(), default)).ReturnsAsync(Array.Empty<Video>());
        _videos.Setup(r => r.AddAsync(It.IsAny<Video>(), default)).Returns(Task.CompletedTask);
        _videos.Setup(r => r.CountAsync(It.IsAny<Expression<Func<Video, bool>>>(), default)).ReturnsAsync(0);
        _videos.Setup(r => r.GetByIdForUserAsync(It.IsAny<Guid>(), _userId, default))
            .ReturnsAsync((Guid id, Guid uid, CancellationToken _) => new Video
            {
                VideoId = id, UserId = uid, CourseId = _courseId, Course = new Course { CourseId = _courseId, CourseName = "Algo", CourseColor = "#000" },
                ExternalVideoId = "abc", VideoUrl = "https://x", SourceType = "youtube", Title = "T", ThumbnailUrl = "th",
            });

        _handler = new SaveVideoCommandHandler(_uow.Object, Options.Create(new AppLimitsOptions { VideoUploadLimit = -1 }));
    }

    private SaveVideoCommand MakeCommand(string? sourceType = "youtube") =>
        new(_userId, _courseId, "abc", "https://youtube.com/watch?v=abc", sourceType, "Title", "thumb.jpg", null);

    [Fact]
    public async Task Handle_ValidRequest_CreatesVideo()
    {
        var result = await _handler.Handle(MakeCommand(), default);

        Assert.True(result.IsSuccess);
        _videos.Verify(r => r.AddAsync(It.IsAny<Video>(), default), Times.Once);
    }

    [Theory]
    [InlineData("YouTube", "youtube")]
    [InlineData(null, "youtube")]
    [InlineData("Vimeo", "vimeo")]
    [InlineData("unknown-site", "youtube")]
    [InlineData(" Upload ", "upload")]
    [InlineData("Bilibili", "bilibili")]
    [InlineData("TED", "ted")]
    [InlineData("DailyMotion", "dailymotion")]
    [InlineData("Facebook", "facebook")]
    [InlineData("Instagram", "instagram")]
    [InlineData("Twitter", "twitter")]
    [InlineData("Reddit", "reddit")]
    [InlineData("LinkedIn", "linkedin")]
    [InlineData("TikTok", "tiktok")]
    public async Task Handle_NormalizesSourceType(string? input, string expected)
    {
        Video? captured = null;
        _videos.Setup(r => r.AddAsync(It.IsAny<Video>(), default))
            .Callback<Video, CancellationToken>((v, _) => captured = v)
            .Returns(Task.CompletedTask);

        await _handler.Handle(MakeCommand(input), default);

        Assert.Equal(expected, captured!.SourceType);
    }

    [Fact]
    public async Task Handle_NegativeLimit_MeansUnlimited()
    {
        var handler = new SaveVideoCommandHandler(_uow.Object, Options.Create(new AppLimitsOptions { VideoUploadLimit = -1 }));

        var result = await handler.Handle(MakeCommand("upload"), default);

        Assert.True(result.IsSuccess);
        _videos.Verify(r => r.CountAsync(It.IsAny<Expression<Func<Video, bool>>>(), default), Times.Never);
    }

    [Fact]
    public async Task Handle_ReusesSummaryFromPreviousRecordWithContent()
    {
        var oldVideoId = Guid.NewGuid();
        var oldRecord = new Video
        {
            VideoId = oldVideoId, UserId = _userId, ExternalVideoId = "abc", SourceType = "youtube",
            Summary = "Cached summary", MindMapText = "cached map", UpdatedAt = DateTime.UtcNow,
        };
        _videos.Setup(r => r.FindAsync(It.IsAny<Expression<Func<Video, bool>>>(), default)).ReturnsAsync(new[] { oldRecord });
        _flashcards.Setup(r => r.FindAsync(It.IsAny<Expression<Func<Flashcard, bool>>>(), default)).ReturnsAsync(Array.Empty<Flashcard>());
        _quizzes.Setup(r => r.FindAsync(It.IsAny<Expression<Func<Quiz, bool>>>(), default)).ReturnsAsync(Array.Empty<Quiz>());
        Video? captured = null;
        _videos.Setup(r => r.AddAsync(It.IsAny<Video>(), default))
            .Callback<Video, CancellationToken>((v, _) => captured = v)
            .Returns(Task.CompletedTask);

        await _handler.Handle(MakeCommand(), default);

        Assert.Equal("Cached summary", captured!.Summary);
        Assert.Equal("cached map", captured.MindMapText);
    }

    [Fact]
    public async Task Handle_CopiesFlashcardsAndQuizzesFromSourceRecord()
    {
        var oldVideoId = Guid.NewGuid();
        var oldRecord = new Video
        {
            VideoId = oldVideoId, UserId = _userId, ExternalVideoId = "abc", SourceType = "youtube",
            Summary = "Cached summary", UpdatedAt = DateTime.UtcNow,
        };
        _videos.Setup(r => r.FindAsync(It.IsAny<Expression<Func<Video, bool>>>(), default)).ReturnsAsync(new[] { oldRecord });
        _flashcards.Setup(r => r.FindAsync(It.IsAny<Expression<Func<Flashcard, bool>>>(), default))
            .ReturnsAsync(new[] { new Flashcard { FlashcardId = Guid.NewGuid(), Front = "Q", Back = "A" } });
        _quizzes.Setup(r => r.FindAsync(It.IsAny<Expression<Func<Quiz, bool>>>(), default))
            .ReturnsAsync(new[] { new Quiz { QuizId = Guid.NewGuid(), Question = "Q", OptionsJson = "[]", CorrectAnswer = "A", Explanation = "E" } });

        await _handler.Handle(MakeCommand(), default);

        _flashcards.Verify(r => r.AddAsync(It.IsAny<Flashcard>(), default), Times.Once);
        _quizzes.Verify(r => r.AddAsync(It.IsAny<Quiz>(), default), Times.Once);
    }
}

public class MoveVideoCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IVideoRepository> _videos = new();
    private readonly Mock<ICourseRepository> _courses = new();
    private readonly MoveVideoCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _videoId = Guid.NewGuid();
    private readonly Guid _targetCourseId = Guid.NewGuid();

    public MoveVideoCommandHandlerTests()
    {
        _uow.Setup(u => u.Videos).Returns(_videos.Object);
        _uow.Setup(u => u.Courses).Returns(_courses.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _handler = new MoveVideoCommandHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_VideoNotFound_ReturnsFailure()
    {
        _videos.Setup(r => r.GetByIdForUserAsync(_videoId, _userId, default)).ReturnsAsync((Video?)null);

        var result = await _handler.Handle(new MoveVideoCommand(_videoId, _userId, _targetCourseId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("VIDEO_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_TargetCourseNotOwned_ReturnsFailure()
    {
        var video = new Video { VideoId = _videoId, UserId = _userId, Course = new Course { CourseName = "A", CourseColor = "#000" } };
        _videos.Setup(r => r.GetByIdForUserAsync(_videoId, _userId, default)).ReturnsAsync(video);
        _courses.Setup(r => r.BelongsToUserAsync(_targetCourseId, _userId, default)).ReturnsAsync(false);

        var result = await _handler.Handle(new MoveVideoCommand(_videoId, _userId, _targetCourseId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("COURSE_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_ValidRequest_UpdatesCourseId()
    {
        var video = new Video { VideoId = _videoId, UserId = _userId, CourseId = Guid.NewGuid(), Course = new Course { CourseName = "A", CourseColor = "#000" } };
        _videos.SetupSequence(r => r.GetByIdForUserAsync(_videoId, _userId, default))
            .ReturnsAsync(video)
            .ReturnsAsync(video);
        _courses.Setup(r => r.BelongsToUserAsync(_targetCourseId, _userId, default)).ReturnsAsync(true);

        var result = await _handler.Handle(new MoveVideoCommand(_videoId, _userId, _targetCourseId), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(_targetCourseId, video.CourseId);
    }
}

public class UpdateVideoCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IVideoRepository> _videos = new();
    private readonly UpdateVideoCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _videoId = Guid.NewGuid();

    public UpdateVideoCommandHandlerTests()
    {
        _uow.Setup(u => u.Videos).Returns(_videos.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _handler = new UpdateVideoCommandHandler(_uow.Object);
    }

    private Video MakeVideo() => new() { VideoId = _videoId, UserId = _userId, Title = "Old", Course = new Course { CourseName = "A", CourseColor = "#000" } };

    [Fact]
    public async Task Handle_VideoNotFound_ReturnsFailure()
    {
        _videos.Setup(r => r.GetByIdForUserAsync(_videoId, _userId, default)).ReturnsAsync((Video?)null);

        var result = await _handler.Handle(new UpdateVideoCommand(_videoId, _userId, "New", null, null), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("VIDEO_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_BlankTitle_ReturnsFailure()
    {
        _videos.Setup(r => r.GetByIdForUserAsync(_videoId, _userId, default)).ReturnsAsync(MakeVideo());

        var result = await _handler.Handle(new UpdateVideoCommand(_videoId, _userId, "   ", null, null), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("INVALID_TITLE", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_TitleTooLong_ReturnsFailure()
    {
        _videos.Setup(r => r.GetByIdForUserAsync(_videoId, _userId, default)).ReturnsAsync(MakeVideo());

        var result = await _handler.Handle(new UpdateVideoCommand(_videoId, _userId, new string('x', 501), null, null), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("INVALID_TITLE", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_NullFields_LeaveExistingValuesUnchanged()
    {
        var video = MakeVideo();
        video.Summary = "existing summary";
        _videos.SetupSequence(r => r.GetByIdForUserAsync(_videoId, _userId, default)).ReturnsAsync(video).ReturnsAsync(video);

        await _handler.Handle(new UpdateVideoCommand(_videoId, _userId, null, null, null), default);

        Assert.Equal("Old", video.Title);
        Assert.Equal("existing summary", video.Summary);
    }

    [Fact]
    public async Task Handle_ValidTitle_TrimsAndUpdates()
    {
        var video = MakeVideo();
        _videos.SetupSequence(r => r.GetByIdForUserAsync(_videoId, _userId, default)).ReturnsAsync(video).ReturnsAsync(video);

        var result = await _handler.Handle(new UpdateVideoCommand(_videoId, _userId, "  New Title  ", null, null), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("New Title", video.Title);
    }
}

public class DeleteVideoCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IVideoRepository> _videos = new();
    private readonly Mock<ILibraryTagRepository> _tags = new();
    private readonly Mock<IEmbeddingIndex> _embeddingIndex = new();
    private readonly DeleteVideoCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _videoId = Guid.NewGuid();

    public DeleteVideoCommandHandlerTests()
    {
        _uow.Setup(u => u.Videos).Returns(_videos.Object);
        _uow.Setup(u => u.LibraryTags).Returns(_tags.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _tags.Setup(r => r.RemoveAssignmentsForItemAsync("video", _videoId, default)).Returns(Task.CompletedTask);
        _embeddingIndex.Setup(e => e.PruneOrphansAsync(_userId, default)).ReturnsAsync(0);
        _handler = new DeleteVideoCommandHandler(_uow.Object, _embeddingIndex.Object);
    }

    [Fact]
    public async Task Handle_NotFound_ReturnsFailure()
    {
        _videos.Setup(r => r.GetByIdForUserAsync(_videoId, _userId, default)).ReturnsAsync((Video?)null);

        var result = await _handler.Handle(new DeleteVideoCommand(_videoId, _userId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_Found_RemovesVideoTagsAndPrunesEmbeddings()
    {
        var video = new Video { VideoId = _videoId, UserId = _userId };
        _videos.Setup(r => r.GetByIdForUserAsync(_videoId, _userId, default)).ReturnsAsync(video);

        var result = await _handler.Handle(new DeleteVideoCommand(_videoId, _userId), default);

        Assert.True(result.IsSuccess);
        _videos.Verify(r => r.Remove(video), Times.Once);
        _tags.Verify(r => r.RemoveAssignmentsForItemAsync("video", _videoId, default), Times.Once);
        _embeddingIndex.Verify(e => e.PruneOrphansAsync(_userId, default), Times.Once);
    }
}

public class GetVideoByIdQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IVideoRepository> _videos = new();
    private readonly Mock<IStudyGroupSharedCourseRepository> _shared = new();
    private readonly Mock<IStudyGroupMemberRepository> _members = new();
    private readonly GetVideoByIdQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _videoId = Guid.NewGuid();
    private readonly Guid _courseId = Guid.NewGuid();

    public GetVideoByIdQueryHandlerTests()
    {
        _uow.Setup(u => u.Videos).Returns(_videos.Object);
        _uow.Setup(u => u.StudyGroupSharedCourses).Returns(_shared.Object);
        _uow.Setup(u => u.StudyGroupMembers).Returns(_members.Object);
        _handler = new GetVideoByIdQueryHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_OwnedVideo_ReturnsIt()
    {
        var video = new Video { VideoId = _videoId, UserId = _userId, Course = new Course { CourseName = "A", CourseColor = "#000" } };
        _videos.Setup(r => r.GetByIdForUserAsync(_videoId, _userId, default)).ReturnsAsync(video);

        var result = await _handler.Handle(new GetVideoByIdQuery(_videoId, _userId), default);

        Assert.True(result.IsSuccess);
    }

    [Fact]
    public async Task Handle_BlankSourceType_FallsBackToYoutubeInDto()
    {
        var video = new Video
        {
            VideoId = _videoId, UserId = _userId, SourceType = "",
            Course = new Course { CourseName = "A", CourseColor = "#000" },
        };
        _videos.Setup(r => r.GetByIdForUserAsync(_videoId, _userId, default)).ReturnsAsync(video);

        var result = await _handler.Handle(new GetVideoByIdQuery(_videoId, _userId), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("youtube", result.Data!.SourceType);
    }

    [Fact]
    public async Task Handle_NotOwnedAndDoesNotExist_ReturnsNotFound()
    {
        _videos.Setup(r => r.GetByIdForUserAsync(_videoId, _userId, default)).ReturnsAsync((Video?)null);
        _videos.Setup(r => r.GetByIdWithCourseAsync(_videoId, default)).ReturnsAsync((Video?)null);

        var result = await _handler.Handle(new GetVideoByIdQuery(_videoId, _userId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_NotOwnedNotSharedWithAnyGroup_ReturnsNotFound()
    {
        var video = new Video { VideoId = _videoId, UserId = Guid.NewGuid(), CourseId = _courseId, Course = new Course { CourseName = "A", CourseColor = "#000" } };
        _videos.Setup(r => r.GetByIdForUserAsync(_videoId, _userId, default)).ReturnsAsync((Video?)null);
        _videos.Setup(r => r.GetByIdWithCourseAsync(_videoId, default)).ReturnsAsync(video);
        _shared.Setup(r => r.FindAsync(It.IsAny<Expression<Func<StudyGroupSharedCourse, bool>>>(), default)).ReturnsAsync(Array.Empty<StudyGroupSharedCourse>());

        var result = await _handler.Handle(new GetVideoByIdQuery(_videoId, _userId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_SharedViaGroupMembership_ReturnsVideo()
    {
        var video = new Video { VideoId = _videoId, UserId = Guid.NewGuid(), CourseId = _courseId, Course = new Course { CourseName = "A", CourseColor = "#000" } };
        var groupId = Guid.NewGuid();
        _videos.Setup(r => r.GetByIdForUserAsync(_videoId, _userId, default)).ReturnsAsync((Video?)null);
        _videos.Setup(r => r.GetByIdWithCourseAsync(_videoId, default)).ReturnsAsync(video);
        _shared.Setup(r => r.FindAsync(It.IsAny<Expression<Func<StudyGroupSharedCourse, bool>>>(), default))
            .ReturnsAsync(new[] { new StudyGroupSharedCourse { GroupId = groupId, CourseId = _courseId } });
        _members.Setup(r => r.ExistsAsync(It.IsAny<Expression<Func<StudyGroupMember, bool>>>(), default)).ReturnsAsync(true);

        var result = await _handler.Handle(new GetVideoByIdQuery(_videoId, _userId), default);

        Assert.True(result.IsSuccess);
    }
}

public class GetVideosQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IVideoRepository> _videos = new();
    private readonly Mock<ICourseRepository> _courses = new();
    private readonly Mock<IStudyGroupSharedCourseRepository> _shared = new();
    private readonly Mock<IStudyGroupMemberRepository> _members = new();
    private readonly GetVideosQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _courseId = Guid.NewGuid();

    public GetVideosQueryHandlerTests()
    {
        _uow.Setup(u => u.Videos).Returns(_videos.Object);
        _uow.Setup(u => u.Courses).Returns(_courses.Object);
        _uow.Setup(u => u.StudyGroupSharedCourses).Returns(_shared.Object);
        _uow.Setup(u => u.StudyGroupMembers).Returns(_members.Object);
        _videos.Setup(r => r.GetPagedAsync(It.IsAny<Guid>(), It.IsAny<Guid?>(), It.IsAny<string?>(), It.IsAny<int>(), It.IsAny<int>(), default))
            .ReturnsAsync((Array.Empty<Video>(), 0));
        _handler = new GetVideosQueryHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_NoCourseFilter_QueriesOwnLibrary()
    {
        var result = await _handler.Handle(new GetVideosQuery(_userId, null, null, 1, 10), default);

        Assert.True(result.IsSuccess);
        _videos.Verify(r => r.GetPagedAsync(_userId, null, null, 1, 10, default), Times.Once);
    }

    [Fact]
    public async Task Handle_OwnCourse_QueriesOwnLibrary()
    {
        _courses.Setup(r => r.GetByIdAsync(_courseId, default)).ReturnsAsync(new Course { CourseId = _courseId, UserId = _userId });

        var result = await _handler.Handle(new GetVideosQuery(_userId, _courseId, null, 1, 10), default);

        Assert.True(result.IsSuccess);
        _videos.Verify(r => r.GetPagedAsync(_userId, _courseId, null, 1, 10, default), Times.Once);
    }

    [Fact]
    public async Task Handle_OtherUsersCourse_NoGroupAccess_ReturnsEmptyResult()
    {
        var ownerId = Guid.NewGuid();
        _courses.Setup(r => r.GetByIdAsync(_courseId, default)).ReturnsAsync(new Course { CourseId = _courseId, UserId = ownerId });
        _shared.Setup(r => r.FindAsync(It.IsAny<Expression<Func<StudyGroupSharedCourse, bool>>>(), default)).ReturnsAsync(Array.Empty<StudyGroupSharedCourse>());

        var result = await _handler.Handle(new GetVideosQuery(_userId, _courseId, null, 1, 10), default);

        Assert.True(result.IsSuccess);
        Assert.Empty(result.Data!.Items);
        _videos.Verify(r => r.GetPagedAsync(It.IsAny<Guid>(), It.IsAny<Guid?>(), It.IsAny<string?>(), It.IsAny<int>(), It.IsAny<int>(), default), Times.Never);
    }

    [Fact]
    public async Task Handle_OtherUsersCourse_WithGroupAccess_QueriesOwnersLibrary()
    {
        var ownerId = Guid.NewGuid();
        var groupId = Guid.NewGuid();
        _courses.Setup(r => r.GetByIdAsync(_courseId, default)).ReturnsAsync(new Course { CourseId = _courseId, UserId = ownerId });
        _shared.Setup(r => r.FindAsync(It.IsAny<Expression<Func<StudyGroupSharedCourse, bool>>>(), default))
            .ReturnsAsync(new[] { new StudyGroupSharedCourse { GroupId = groupId, CourseId = _courseId } });
        _members.Setup(r => r.ExistsAsync(It.IsAny<Expression<Func<StudyGroupMember, bool>>>(), default)).ReturnsAsync(true);

        var result = await _handler.Handle(new GetVideosQuery(_userId, _courseId, null, 1, 10), default);

        Assert.True(result.IsSuccess);
        _videos.Verify(r => r.GetPagedAsync(ownerId, _courseId, null, 1, 10, default), Times.Once);
    }

    [Fact]
    public async Task Handle_ComputesTotalPagesFromCount()
    {
        _videos.Setup(r => r.GetPagedAsync(It.IsAny<Guid>(), It.IsAny<Guid?>(), It.IsAny<string?>(), It.IsAny<int>(), It.IsAny<int>(), default))
            .ReturnsAsync((Array.Empty<Video>(), 25));

        var result = await _handler.Handle(new GetVideosQuery(_userId, null, null, 1, 10), default);

        Assert.Equal(3, result.Data!.TotalPages);
    }
}

public class GetVideosLiteQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IVideoRepository> _videos = new();
    private readonly GetVideosLiteQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public GetVideosLiteQueryHandlerTests()
    {
        _uow.Setup(u => u.Videos).Returns(_videos.Object);
        _handler = new GetVideosLiteQueryHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_MapsItemsAndComputesTotalPages()
    {
        var item = new VideoListItem(Guid.NewGuid(), Guid.NewGuid(), "Algo", "#000", "vid1", "https://x", "youtube", "Title", "thumb", DateTime.UtcNow);
        _videos.Setup(r => r.GetPagedLiteAsync(_userId, 1, 10, default)).ReturnsAsync((new[] { item }, 15));

        var result = await _handler.Handle(new GetVideosLiteQuery(_userId, 1, 10), default);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Data!.Items);
        Assert.Equal(2, result.Data.TotalPages);
    }
}
