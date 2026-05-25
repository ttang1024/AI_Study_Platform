using System.Linq.Expressions;
using Microsoft.Extensions.Options;
using Moq;
using StudyPlatform.Application.Settings;
using StudyPlatform.Application.YouTube.Commands;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.YouTube;

public class SaveYouTubeVideoCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IYouTubeVideoRepository> _videos = new();
    private readonly SaveYouTubeVideoCommandHandler _handler;

    private readonly Guid _courseId = Guid.NewGuid();
    private readonly Guid _userId = Guid.NewGuid();

    public SaveYouTubeVideoCommandHandlerTests()
    {
        _uow.Setup(u => u.YouTubeVideos).Returns(_videos.Object);
        _handler = new SaveYouTubeVideoCommandHandler(
            _uow.Object,
            Options.Create(new AppLimitsOptions { VideoUploadLimit = 10 }));
    }

    [Fact]
    public async Task Handle_UploadVideoLimitReached_ReturnsFailureWithoutSaving()
    {
        _videos.Setup(r => r.CountAsync(It.IsAny<Expression<Func<YouTubeVideo, bool>>>(), default))
            .ReturnsAsync(10);

        var result = await _handler.Handle(new SaveYouTubeVideoCommand(
            _userId,
            _courseId,
            "upload-local",
            "blob://video",
            "upload",
            "Lecture",
            "",
            null), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("VIDEO_LIMIT_REACHED", result.ErrorCode);
        _videos.Verify(r => r.AddAsync(It.IsAny<YouTubeVideo>(), default), Times.Never);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Never);
    }
}
