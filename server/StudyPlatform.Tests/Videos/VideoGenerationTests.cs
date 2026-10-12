using System.Linq.Expressions;
using Microsoft.Extensions.Options;
using Moq;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.Settings;
using StudyPlatform.Application.Videos.Commands;
using StudyPlatform.Application.Videos.Generation;
using StudyPlatform.Application.Videos.Transcripts;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Tests.TestSupport;
using Xunit;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Videos;

namespace StudyPlatform.Tests.Videos;

public class GenerateVideoGlossaryCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IVideoRepository> _videos = new();
    private readonly Mock<IGlossaryTermRepository> _terms = new();
    private readonly Mock<IAiService> _ai = new();
    private readonly Mock<IVideoTranscriptProvider> _transcripts = new();
    private readonly GenerateVideoGlossaryCommandHandler _handler;
    private readonly Guid _videoId = Guid.NewGuid();
    private readonly Guid _userId = Guid.NewGuid();

    public GenerateVideoGlossaryCommandHandlerTests()
    {
        _videos.Setup(r => r.GetByIdForUserAsync(_videoId, _userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Video { VideoId = _videoId, UserId = _userId });
        _transcripts.Setup(t => t.GetOrFetchTranscriptAsync(It.IsAny<Video>(), It.IsAny<CancellationToken>())).ReturnsAsync("transcript");
        _handler = new GenerateVideoGlossaryCommandHandler(
            _uow.Object, _terms.Object, new VideoAccess(_videos.Object, new CourseAccess(Mock.Of<IStudyGroupSharedCourseRepository>(), Mock.Of<IStudyGroupMemberRepository>())), _ai.Object, _transcripts.Object, new InMemoryAppCache(), Options.Create(new CacheOptions()));
    }

    [Fact]
    public async Task Regenerating_ReplacesOnlyTheCallersTerms()
    {
        _ai.Setup(a => a.GenerateGlossaryAsync("transcript", It.IsAny<CancellationToken>()))
            .ReturnsAsync("""[{"term":"Entropy","definition":"Disorder"}]""");

        var result = await _handler.Handle(new GenerateVideoGlossaryCommand(_videoId, _userId), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("Entropy", Assert.Single(result.Data!).Term);
        _terms.Verify(r => r.DeleteByVideoIdAsync(_videoId, _userId, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task UnparseableModelOutput_DeletesNothing()
    {
        _ai.Setup(a => a.GenerateGlossaryAsync("transcript", It.IsAny<CancellationToken>())).ReturnsAsync("not json");

        var result = await _handler.Handle(new GenerateVideoGlossaryCommand(_videoId, _userId), default);

        Assert.Equal("PARSE_ERROR", result.ErrorCode);
        _terms.Verify(r => r.DeleteByVideoIdAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task VideoTheCallerCannotSee_IsNotFound()
    {
        var result = await _handler.Handle(new GenerateVideoGlossaryCommand(Guid.NewGuid(), _userId), default);
        Assert.Equal("VIDEO_NOT_FOUND", result.ErrorCode);
    }
}

public class VideoAiGeneratorTests
{
    private readonly Mock<IAiService> _ai = new();
    private readonly Mock<IVideoTranscriptProvider> _transcripts = new();
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IVideoRepository> _videos = new();
    private readonly Mock<IStudyGroupSharedCourseRepository> _sharedCourses = new();
    private readonly Mock<IStudyGroupMemberRepository> _members = new();
    private readonly InMemoryAppCache _cache = new();
    private readonly Guid _ownerId = Guid.NewGuid();

    public VideoAiGeneratorTests()
    {
        _transcripts.Setup(t => t.GetTranscriptTextAsync("dQw4w9WgXcQ", It.IsAny<CancellationToken>())).ReturnsAsync("transcript");
        _ai.Setup(a => a.GenerateMindMapFromYouTubeAsync("transcript", It.IsAny<CancellationToken>())).ReturnsAsync("# map");
    }

    private VideoAiGenerator For(Guid userId) => new(
        _ai.Object,
        Services.AiTestCredentials.Provider("openai", "gpt-4o-mini", "k", userId),
        _transcripts.Object,
        _cache,
        _uow.Object,
        _videos.Object,
        new VideoAccess(_videos.Object, new CourseAccess(_sharedCourses.Object, _members.Object)),
        Options.Create(new CacheOptions()));

    [Fact]
    public async Task UrlResult_IsCachedPerUser_NotSharedBetweenUsers()
    {
        const string url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

        await For(Guid.NewGuid()).GenerateForUrlAsync(url, VideoAiArtifact.MindMap, default);
        await For(Guid.NewGuid()).GenerateForUrlAsync(url, VideoAiArtifact.MindMap, default);

        // Two users, two generations: the second user's request doesn't ride on the first one's spend.
        _ai.Verify(a => a.GenerateMindMapFromYouTubeAsync("transcript", It.IsAny<CancellationToken>()), Times.Exactly(2));
    }

    [Fact]
    public async Task UrlResult_IsServedFromCache_ToTheSameUser()
    {
        var generator = For(Guid.NewGuid());
        const string url = "https://youtu.be/dQw4w9WgXcQ";

        await generator.GenerateForUrlAsync(url, VideoAiArtifact.MindMap, default);
        var second = await generator.StreamForUrlAsync(url, VideoAiArtifact.MindMap, default);

        Assert.Equal("# map", second.Data!.Cached);
        _ai.Verify(a => a.GenerateMindMapFromYouTubeAsync("transcript", It.IsAny<CancellationToken>()), Times.Once);
    }

    [Theory]
    [InlineData(null, "MISSING_VIDEO_URL")]
    [InlineData("https://example.com/not-a-video", "INVALID_VIDEO_URL")]
    public async Task BadUrls_AreRejectedBeforeAnyWork(string? url, string expected)
    {
        var result = await For(Guid.NewGuid()).GenerateForUrlAsync(url, VideoAiArtifact.Quiz, default);
        Assert.Equal(expected, result.ErrorCode);
    }

    [Fact]
    public async Task SavedVideoSummary_IsStoredForTheOwner_ButNotForASharedCourseMember()
    {
        var videoId = Guid.NewGuid();
        var courseId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        var video = new Video { VideoId = videoId, UserId = _ownerId, CourseId = courseId };
        _videos.Setup(r => r.GetByIdForUserAsync(videoId, _ownerId, It.IsAny<CancellationToken>())).ReturnsAsync(video);
        _videos.Setup(r => r.GetByIdWithCourseAsync(videoId, It.IsAny<CancellationToken>())).ReturnsAsync(video);
        _sharedCourses.Setup(r => r.FindAsync(It.IsAny<Expression<Func<StudyGroupSharedCourse, bool>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync([new StudyGroupSharedCourse { CourseId = courseId, GroupId = Guid.NewGuid() }]);
        _members.Setup(r => r.ExistsAsync(It.IsAny<Expression<Func<StudyGroupMember, bool>>>(), It.IsAny<CancellationToken>())).ReturnsAsync(true);
        _transcripts.Setup(t => t.GetOrFetchTimelineTranscriptAsync(video, It.IsAny<CancellationToken>())).ReturnsAsync("[00:00] hi");

        var asOwner = await For(_ownerId).StreamForSavedVideoAsync(videoId, _ownerId, VideoAiArtifact.Summary, default);
        var asMember = await For(memberId).StreamForSavedVideoAsync(videoId, memberId, VideoAiArtifact.Summary, default);

        Assert.NotNull(asOwner.Data!.OnCompleted);
        Assert.True(asMember.IsSuccess);
        Assert.Null(asMember.Data!.OnCompleted);
    }
}
