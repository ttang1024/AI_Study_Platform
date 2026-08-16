using Moq;
using StudyPlatform.Application.Security.Commands;
using StudyPlatform.Application.Security.Queries;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using Xunit;

namespace StudyPlatform.Tests.Security;

public class DataExportMapperTests
{
    [Fact]
    public void IsDownloadable_CompletedWithBlobAndNoExpiry_IsTrue()
    {
        var entity = new DataExportRequest { Status = DataExportStatus.Completed, BlobUrl = "https://blob", ExpiresAt = null };

        Assert.True(DataExportMapper.IsDownloadable(entity));
    }

    [Fact]
    public void IsDownloadable_NotCompleted_IsFalse()
    {
        var entity = new DataExportRequest { Status = DataExportStatus.Running, BlobUrl = "https://blob" };

        Assert.False(DataExportMapper.IsDownloadable(entity));
    }

    [Fact]
    public void IsDownloadable_NoBlobUrl_IsFalse()
    {
        var entity = new DataExportRequest { Status = DataExportStatus.Completed, BlobUrl = null };

        Assert.False(DataExportMapper.IsDownloadable(entity));
    }

    [Fact]
    public void IsDownloadable_Expired_IsFalse()
    {
        var entity = new DataExportRequest { Status = DataExportStatus.Completed, BlobUrl = "https://blob", ExpiresAt = DateTime.UtcNow.AddMinutes(-1) };

        Assert.False(DataExportMapper.IsDownloadable(entity));
    }

    [Fact]
    public void IsDownloadable_NotYetExpired_IsTrue()
    {
        var entity = new DataExportRequest { Status = DataExportStatus.Completed, BlobUrl = "https://blob", ExpiresAt = DateTime.UtcNow.AddMinutes(1) };

        Assert.True(DataExportMapper.IsDownloadable(entity));
    }

    [Fact]
    public void ToDto_MapsIsDownloadableFlag()
    {
        var entity = new DataExportRequest { DataExportRequestId = Guid.NewGuid(), Status = DataExportStatus.Completed, BlobUrl = "https://blob" };

        var dto = DataExportMapper.ToDto(entity);

        Assert.True(dto.IsDownloadable);
    }
}

public class RequestDataExportCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IDataExportRequestRepository> _exports = new();
    private readonly Mock<IAuditLogger> _audit = new();
    private readonly RequestDataExportCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public RequestDataExportCommandHandlerTests()
    {
        _uow.Setup(u => u.DataExportRequests).Returns(_exports.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _exports.Setup(r => r.AddAsync(It.IsAny<DataExportRequest>(), default)).Returns(Task.CompletedTask);
        _handler = new RequestDataExportCommandHandler(_uow.Object, _audit.Object);
    }

    [Fact]
    public async Task Handle_ActiveExportAlreadyPending_ReturnsFailure()
    {
        _exports.Setup(r => r.GetActiveForUserAsync(_userId, default))
            .ReturnsAsync(new DataExportRequest { UserId = _userId, Status = DataExportStatus.Pending });

        var result = await _handler.Handle(new RequestDataExportCommand(_userId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("EXPORT_ALREADY_PENDING", result.ErrorCode);
        _exports.Verify(r => r.AddAsync(It.IsAny<DataExportRequest>(), default), Times.Never);
    }

    [Fact]
    public async Task Handle_NoActiveExport_CreatesPendingRequest()
    {
        _exports.Setup(r => r.GetActiveForUserAsync(_userId, default)).ReturnsAsync((DataExportRequest?)null);

        var result = await _handler.Handle(new RequestDataExportCommand(_userId), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(DataExportStatus.Pending, result.Data!.Status);
        _exports.Verify(r => r.AddAsync(It.Is<DataExportRequest>(e => e.UserId == _userId), default), Times.Once);
    }
}

public class GetDataExportsQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IDataExportRequestRepository> _exports = new();
    private readonly GetDataExportsQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public GetDataExportsQueryHandlerTests()
    {
        _uow.Setup(u => u.DataExportRequests).Returns(_exports.Object);
        _handler = new GetDataExportsQueryHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_MapsExportsToDtos()
    {
        _exports.Setup(r => r.GetForUserAsync(_userId, default))
            .ReturnsAsync(new[] { new DataExportRequest { DataExportRequestId = Guid.NewGuid(), UserId = _userId, Status = DataExportStatus.Completed } });

        var result = await _handler.Handle(new GetDataExportsQuery(_userId), default);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Data!);
    }
}

public class GetDataExportDownloadQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<IDataExportRequestRepository> _exports = new();
    private readonly Mock<IBlobStorageService> _blobStorage = new();
    private readonly Mock<IAuditLogger> _audit = new();
    private readonly GetDataExportDownloadQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _exportId = Guid.NewGuid();

    public GetDataExportDownloadQueryHandlerTests()
    {
        _uow.Setup(u => u.DataExportRequests).Returns(_exports.Object);
        _handler = new GetDataExportDownloadQueryHandler(_uow.Object, _blobStorage.Object, _audit.Object);
    }

    [Fact]
    public async Task Handle_ExportNotFound_ReturnsFailure()
    {
        _exports.Setup(r => r.GetByIdAsync(_exportId, default)).ReturnsAsync((DataExportRequest?)null);

        var result = await _handler.Handle(new GetDataExportDownloadQuery(_userId, _exportId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("EXPORT_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_ExportOwnedByOtherUser_ReturnsNotFound()
    {
        _exports.Setup(r => r.GetByIdAsync(_exportId, default))
            .ReturnsAsync(new DataExportRequest { DataExportRequestId = _exportId, UserId = Guid.NewGuid(), Status = DataExportStatus.Completed, BlobUrl = "https://blob" });

        var result = await _handler.Handle(new GetDataExportDownloadQuery(_userId, _exportId), default);

        Assert.Equal("EXPORT_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_FailedExport_ReturnsFailedSpecificMessage()
    {
        _exports.Setup(r => r.GetByIdAsync(_exportId, default))
            .ReturnsAsync(new DataExportRequest { DataExportRequestId = _exportId, UserId = _userId, Status = DataExportStatus.Failed });

        var result = await _handler.Handle(new GetDataExportDownloadQuery(_userId, _exportId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("EXPORT_NOT_READY", result.ErrorCode);
        Assert.Contains("failed", result.Message);
    }

    [Fact]
    public async Task Handle_PendingExport_ReturnsNotReadyMessage()
    {
        _exports.Setup(r => r.GetByIdAsync(_exportId, default))
            .ReturnsAsync(new DataExportRequest { DataExportRequestId = _exportId, UserId = _userId, Status = DataExportStatus.Pending });

        var result = await _handler.Handle(new GetDataExportDownloadQuery(_userId, _exportId), default);

        Assert.Contains("isn't ready", result.Message);
    }

    [Fact]
    public async Task Handle_DownloadableExport_ReturnsSignedUrlAndAudits()
    {
        _exports.Setup(r => r.GetByIdAsync(_exportId, default))
            .ReturnsAsync(new DataExportRequest { DataExportRequestId = _exportId, UserId = _userId, Status = DataExportStatus.Completed, BlobUrl = "https://blob/x.zip" });
        _blobStorage.Setup(b => b.GetSasUrlAsync("https://blob/x.zip", 10, default)).ReturnsAsync("https://signed-url");

        var result = await _handler.Handle(new GetDataExportDownloadQuery(_userId, _exportId), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("https://signed-url", result.Data);
        _audit.Verify(a => a.LogAsync(AuditActions.DataExportDownloaded, _userId, null, "DataExportRequest", _exportId.ToString(), null, default), Times.Once);
    }
}
