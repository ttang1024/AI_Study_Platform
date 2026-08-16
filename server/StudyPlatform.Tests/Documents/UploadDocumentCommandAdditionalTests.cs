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

/// <summary>Covers the branches not exercised by <c>UploadDocumentCommandHandlerTests</c>: course
/// ownership, the document-upload limit, blob-storage failure, and non-seekable input streams.</summary>
public class UploadDocumentCommandAdditionalTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<ICourseRepository> _courses = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<IBlobStorageService> _storage = new();
    private readonly Mock<ILogger<UploadDocumentCommandHandler>> _logger = new();

    private readonly Guid _courseId = Guid.NewGuid();
    private readonly Guid _userId = Guid.NewGuid();

    public UploadDocumentCommandAdditionalTests()
    {
        _uow.Setup(u => u.Courses).Returns(_courses.Object);
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
    }

    private UploadDocumentCommandHandler MakeHandler(int documentUploadLimit = -1) => new(
        _uow.Object, _storage.Object, Options.Create(new AppLimitsOptions { DocumentUploadLimit = documentUploadLimit }), _logger.Object);

    [Fact]
    public async Task Handle_CourseNotFound_ReturnsFailure()
    {
        _courses.Setup(r => r.GetByIdAsync(_courseId, default)).ReturnsAsync((Course?)null);
        using var stream = new MemoryStream("hello"u8.ToArray());

        var result = await MakeHandler().Handle(new UploadDocumentCommand(_courseId, _userId, "f.txt", "text/plain", stream.Length, stream), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("COURSE_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_CourseNotOwned_ReturnsFailure()
    {
        _courses.Setup(r => r.GetByIdAsync(_courseId, default)).ReturnsAsync(new Course { CourseId = _courseId, UserId = Guid.NewGuid() });
        using var stream = new MemoryStream("hello"u8.ToArray());

        var result = await MakeHandler().Handle(new UploadDocumentCommand(_courseId, _userId, "f.txt", "text/plain", stream.Length, stream), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("COURSE_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_DocumentUploadLimitReached_ReturnsFailure()
    {
        _courses.Setup(r => r.GetByIdAsync(_courseId, default)).ReturnsAsync(new Course { CourseId = _courseId, UserId = _userId });
        _documents.Setup(r => r.CountByUserIdAsync(_userId, default)).ReturnsAsync(5);
        using var stream = new MemoryStream("hello"u8.ToArray());

        var result = await MakeHandler(documentUploadLimit: 5).Handle(
            new UploadDocumentCommand(_courseId, _userId, "f.txt", "text/plain", stream.Length, stream), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("DOCUMENT_LIMIT_REACHED", result.ErrorCode);
        _storage.Verify(s => s.UploadAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<string>(), default), Times.Never);
    }

    [Fact]
    public async Task Handle_BlobUploadThrows_ReturnsStorageError()
    {
        _courses.Setup(r => r.GetByIdAsync(_courseId, default)).ReturnsAsync(new Course { CourseId = _courseId, UserId = _userId });
        _documents.Setup(r => r.CountByUserIdAsync(_userId, default)).ReturnsAsync(0);
        _storage.Setup(s => s.UploadAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<string>(), default))
            .ThrowsAsync(new InvalidOperationException("boom"));
        using var stream = new MemoryStream("hello"u8.ToArray());

        var result = await MakeHandler().Handle(new UploadDocumentCommand(_courseId, _userId, "f.txt", "text/plain", stream.Length, stream), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("STORAGE_ERROR", result.ErrorCode);
        _documents.Verify(r => r.AddAsync(It.IsAny<Document>(), default), Times.Never);
    }

    [Fact]
    public async Task Handle_NonSeekableStream_BuffersAndHashesCorrectly()
    {
        _courses.Setup(r => r.GetByIdAsync(_courseId, default)).ReturnsAsync(new Course { CourseId = _courseId, UserId = _userId });
        _documents.Setup(r => r.CountByUserIdAsync(_userId, default)).ReturnsAsync(0);
        _storage.Setup(s => s.UploadAsync(It.IsAny<Stream>(), It.IsAny<string>(), It.IsAny<string>(), default))
            .ReturnsAsync("blob://uploaded");
        using var nonSeekable = new NonSeekableStream("hello"u8.ToArray());

        var result = await MakeHandler().Handle(
            new UploadDocumentCommand(_courseId, _userId, "f.txt", "text/plain", 5, nonSeekable), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824", result.Data!.FileHash);
    }

    private sealed class NonSeekableStream : Stream
    {
        private readonly MemoryStream _inner;
        public NonSeekableStream(byte[] data) => _inner = new MemoryStream(data);
        public override bool CanRead => true;
        public override bool CanSeek => false;
        public override bool CanWrite => false;
        public override long Length => throw new NotSupportedException();
        public override long Position { get => throw new NotSupportedException(); set => throw new NotSupportedException(); }
        public override void Flush() => _inner.Flush();
        public override int Read(byte[] buffer, int offset, int count) => _inner.Read(buffer, offset, count);
        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
        public override void SetLength(long value) => throw new NotSupportedException();
        public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
    }
}
