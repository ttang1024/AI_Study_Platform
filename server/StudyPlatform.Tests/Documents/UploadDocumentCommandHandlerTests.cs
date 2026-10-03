using System.Linq.Expressions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using StudyPlatform.Application.Documents.Commands;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.Settings;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Documents;

public class UploadDocumentCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<ICourseRepository> _courses = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<IBlobStorageService> _storage = new();
    private readonly Mock<ILogger<UploadDocumentCommandHandler>> _logger = new();
    private readonly UploadDocumentCommandHandler _handler;

    private readonly Guid _courseId = Guid.NewGuid();
    private readonly Guid _userId = Guid.NewGuid();

    public UploadDocumentCommandHandlerTests()
    {
        _uow.Setup(u => u.Courses).Returns(_courses.Object);
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);

        _courses.Setup(r => r.GetByIdAsync(_courseId, default)).ReturnsAsync(new Course
        {
            CourseId = _courseId,
            UserId = _userId,
            CourseName = "Course",
            CourseColor = "#000000",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        });

        _documents.Setup(r => r.CountByUserIdAsync(_userId, default)).ReturnsAsync(0);
        _storage.Setup(s => s.UploadAsync(It.IsAny<Stream>(), It.IsAny<string>(), "text/plain", default))
            .ReturnsAsync("blob://uploaded");

        _handler = new UploadDocumentCommandHandler(
            _uow.Object,
            _storage.Object,
            Options.Create(new AppLimitsOptions { DocumentUploadLimit = -1 }),
            _logger.Object);
    }

    [Fact]
    public async Task Handle_NewFile_StoresHashAndUploadsFromStart()
    {
        using var stream = new MemoryStream("hello"u8.ToArray());
        Stream? uploadedStream = null;

        _storage.Setup(s => s.UploadAsync(It.IsAny<Stream>(), It.IsAny<string>(), "text/plain", default))
            .Callback<Stream, string, string, CancellationToken>((s, _, _, _) => uploadedStream = s)
            .ReturnsAsync("blob://uploaded");

        var result = await _handler.Handle(new UploadDocumentCommand(
            _courseId, _userId, "notes.txt", "text/plain", stream.Length, stream), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824", result.Data!.FileHash);
        Assert.Equal(0, uploadedStream!.Position);
        _documents.Verify(r => r.AddAsync(It.Is<Document>(d => d.FileHash == result.Data!.FileHash), default), Times.Once);
    }

    [Fact]
    public async Task Handle_DuplicateHash_ReturnsFailureWithoutUploading()
    {
        using var stream = new MemoryStream("hello"u8.ToArray());
        _documents.Setup(r => r.GetByUserIdAndFileHashAsync(
                _userId,
                "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
                default))
            .ReturnsAsync(new Document
            {
                DocumentId = Guid.NewGuid(),
                CourseId = _courseId,
                UserId = _userId,
                FileName = "existing.txt"
            });

        var result = await _handler.Handle(new UploadDocumentCommand(
            _courseId, _userId, "notes.txt", "text/plain", stream.Length, stream), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("DUPLICATE_DOCUMENT", result.ErrorCode);
        _storage.Verify(s => s.UploadAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<string>(), default), Times.Never);
        _documents.Verify(r => r.AddAsync(It.IsAny<Document>(), default), Times.Never);
    }

    [Fact]
    public async Task Handle_AudioLimitReached_ReturnsFailureWithoutUploading()
    {
        using var stream = new MemoryStream("audio"u8.ToArray());
        _documents.Setup(r => r.CountAsync(It.IsAny<Expression<Func<Document, bool>>>(), default))
            .ReturnsAsync(10);

        var handler = new UploadDocumentCommandHandler(
            _uow.Object,
            _storage.Object,
            Options.Create(new AppLimitsOptions { DocumentUploadLimit = -1, AudioUploadLimit = 10 }),
            _logger.Object);

        var result = await handler.Handle(new UploadDocumentCommand(
            _courseId, _userId, "lecture.mp3", "audio/mpeg", stream.Length, stream), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("AUDIO_LIMIT_REACHED", result.ErrorCode);
        _storage.Verify(s => s.UploadAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<string>(), default), Times.Never);
        _documents.Verify(r => r.AddAsync(It.IsAny<Document>(), default), Times.Never);
    }
}
