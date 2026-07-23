using System.Linq.Expressions;
using Moq;
using StudyPlatform.Application.Courses.Commands;
using StudyPlatform.Application.Courses.Queries;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Domain.Projections;
using Xunit;

namespace StudyPlatform.Tests.Courses;

public class CreateCourseCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<ICourseRepository> _courses = new();
    private readonly CreateCourseCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public CreateCourseCommandHandlerTests()
    {
        _uow.Setup(u => u.Courses).Returns(_courses.Object);
        _courses.Setup(r => r.AddAsync(It.IsAny<Course>(), default)).Returns(Task.CompletedTask);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _handler = new CreateCourseCommandHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_ValidCommand_ReturnsMappedCourseDto()
    {
        var result = await _handler.Handle(new CreateCourseCommand(_userId, "Algorithms 101", "#3B82F6"), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("Algorithms 101", result.Data!.CourseName);
        Assert.Equal("#3B82F6", result.Data.CourseColor);
        Assert.Equal(_userId, result.Data.UserId);
        Assert.Equal(0, result.Data.DocumentCount);
        _courses.Verify(r => r.AddAsync(It.IsAny<Course>(), default), Times.Once);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Once);
    }

    [Fact]
    public async Task Handle_AssignsFreshCourseId()
    {
        Course? captured = null;
        _courses.Setup(r => r.AddAsync(It.IsAny<Course>(), default))
            .Callback<Course, CancellationToken>((c, _) => captured = c)
            .Returns(Task.CompletedTask);

        await _handler.Handle(new CreateCourseCommand(_userId, "Test", "#fff"), default);

        Assert.NotEqual(Guid.Empty, captured?.CourseId);
    }
}

public class UpdateCourseCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<ICourseRepository> _courses = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly UpdateCourseCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public UpdateCourseCommandHandlerTests()
    {
        _uow.Setup(u => u.Courses).Returns(_courses.Object);
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _handler = new UpdateCourseCommandHandler(_uow.Object);
    }

    private Course MakeCourse(Guid? userId = null) => new()
    {
        CourseId = Guid.NewGuid(),
        UserId = userId ?? _userId,
        CourseName = "Old Name",
        CourseColor = "#000000"
    };

    [Fact]
    public async Task Handle_OwnedCourse_UpdatesAndReturnsDto()
    {
        var course = MakeCourse();
        _courses.Setup(r => r.GetByIdAsync(course.CourseId, default)).ReturnsAsync(course);

        var result = await _handler.Handle(new UpdateCourseCommand(course.CourseId, _userId, "New Name", "#FF5733"), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("New Name", result.Data!.CourseName);
        Assert.Equal("#FF5733", result.Data.CourseColor);
        _courses.Verify(r => r.Update(course), Times.Once);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Once);
    }

    [Fact]
    public async Task Handle_CourseNotFound_ReturnsFailure()
    {
        _courses.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), default)).ReturnsAsync((Course?)null);

        var result = await _handler.Handle(new UpdateCourseCommand(Guid.NewGuid(), _userId, "Name", "#fff"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("COURSE_NOT_FOUND", result.ErrorCode);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Never);
    }

    [Fact]
    public async Task Handle_CourseOwnedByOtherUser_ReturnsFailure()
    {
        var course = MakeCourse(userId: Guid.NewGuid());
        _courses.Setup(r => r.GetByIdAsync(course.CourseId, default)).ReturnsAsync(course);

        var result = await _handler.Handle(new UpdateCourseCommand(course.CourseId, _userId, "Name", "#fff"), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("COURSE_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_DocumentCountComesFromCountQuery()
    {
        var course = MakeCourse();
        _courses.Setup(r => r.GetByIdAsync(course.CourseId, default)).ReturnsAsync(course);
        _documents
            .Setup(r => r.CountAsync(It.IsAny<Expression<Func<Document, bool>>>(), default))
            .ReturnsAsync(2);

        var result = await _handler.Handle(new UpdateCourseCommand(course.CourseId, _userId, "Name", "#abc"), default);

        Assert.Equal(2, result.Data!.DocumentCount);
    }

    [Fact]
    public async Task Handle_DoesNotLoadTheCourseDocuments()
    {
        var course = MakeCourse();
        _courses.Setup(r => r.GetByIdAsync(course.CourseId, default)).ReturnsAsync(course);

        await _handler.Handle(new UpdateCourseCommand(course.CourseId, _userId, "Name", "#abc"), default);

        // Renaming a course must not read every document's text just to report how many there are.
        _documents.Verify(r => r.GetByCourseIdAsync(It.IsAny<Guid>(), default), Times.Never);
    }
}

public class DeleteCourseCommandHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<ICourseRepository> _courses = new();
    private readonly Mock<IDocumentRepository> _documents = new();
    private readonly Mock<IBlobStorageService> _blob = new();
    private readonly DeleteCourseCommandHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public DeleteCourseCommandHandlerTests()
    {
        _uow.Setup(u => u.Courses).Returns(_courses.Object);
        _uow.Setup(u => u.Documents).Returns(_documents.Object);
        _documents.Setup(r => r.GetBlobUrlsByCourseAsync(It.IsAny<Guid>(), default))
            .ReturnsAsync(Array.Empty<string>());
        _uow.Setup(u => u.SaveChangesAsync(default)).ReturnsAsync(1);
        _handler = new DeleteCourseCommandHandler(_uow.Object, _blob.Object);
    }

    private Course MakeCourse(Guid? userId = null) => new()
    {
        CourseId = Guid.NewGuid(),
        UserId = userId ?? _userId
    };

    private void WithBlobUrls(Guid courseId, params string[] urls)
        => _documents.Setup(r => r.GetBlobUrlsByCourseAsync(courseId, default)).ReturnsAsync(urls);

    [Fact]
    public async Task Handle_OwnedCourse_DeletesAndReturnsSuccess()
    {
        var course = MakeCourse();
        _courses.Setup(r => r.GetByIdAsync(course.CourseId, default)).ReturnsAsync(course);

        var result = await _handler.Handle(new DeleteCourseCommand(course.CourseId, _userId), default);

        Assert.True(result.IsSuccess);
        _courses.Verify(r => r.Remove(course), Times.Once);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Once);
    }

    [Fact]
    public async Task Handle_CourseNotFound_ReturnsFailure()
    {
        _courses.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), default)).ReturnsAsync((Course?)null);

        var result = await _handler.Handle(new DeleteCourseCommand(Guid.NewGuid(), _userId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("COURSE_NOT_FOUND", result.ErrorCode);
        _uow.Verify(u => u.SaveChangesAsync(default), Times.Never);
    }

    [Fact]
    public async Task Handle_CourseWithDocuments_DeletesBlobsBeforeRemoving()
    {
        var course = MakeCourse();
        WithBlobUrls(course.CourseId, "blob://doc1", "blob://doc2");
        _courses.Setup(r => r.GetByIdAsync(course.CourseId, default)).ReturnsAsync(course);
        _blob.Setup(b => b.DeleteAsync(It.IsAny<string>(), default)).Returns(Task.CompletedTask);

        var result = await _handler.Handle(new DeleteCourseCommand(course.CourseId, _userId), default);

        Assert.True(result.IsSuccess);
        _blob.Verify(b => b.DeleteAsync("blob://doc1", default), Times.Once);
        _blob.Verify(b => b.DeleteAsync("blob://doc2", default), Times.Once);
    }

    [Fact]
    public async Task Handle_BlobDeletionFails_StillDeletesCourse()
    {
        var course = MakeCourse();
        WithBlobUrls(course.CourseId, "blob://bad");
        _courses.Setup(r => r.GetByIdAsync(course.CourseId, default)).ReturnsAsync(course);
        _blob.Setup(b => b.DeleteAsync(It.IsAny<string>(), default)).ThrowsAsync(new Exception("Storage error"));

        var result = await _handler.Handle(new DeleteCourseCommand(course.CourseId, _userId), default);

        Assert.True(result.IsSuccess);
        _courses.Verify(r => r.Remove(course), Times.Once);
    }

    [Fact]
    public async Task Handle_CourseOwnedByOtherUser_ReturnsFailure()
    {
        var course = MakeCourse(userId: Guid.NewGuid());
        _courses.Setup(r => r.GetByIdAsync(course.CourseId, default)).ReturnsAsync(course);

        var result = await _handler.Handle(new DeleteCourseCommand(course.CourseId, _userId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("COURSE_NOT_FOUND", result.ErrorCode);
        _courses.Verify(r => r.Remove(It.IsAny<Course>()), Times.Never);
    }
}

public class GetAllCoursesQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<ICourseRepository> _courses = new();
    private readonly GetAllCoursesQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();

    public GetAllCoursesQueryHandlerTests()
    {
        _uow.Setup(u => u.Courses).Returns(_courses.Object);
        _handler = new GetAllCoursesQueryHandler(_uow.Object);
    }

    [Fact]
    public async Task Handle_ReturnsMappedCourseDtos()
    {
        var course = new CourseListItem(
            Guid.NewGuid(), _userId, "Math", "#3B82F6", 2, DateTime.UtcNow, DateTime.UtcNow);
        _courses.Setup(r => r.GetListItemsByUserAsync(_userId, default)).ReturnsAsync(new[] { course });

        var result = await _handler.Handle(new GetAllCoursesQuery(_userId), default);

        Assert.True(result.IsSuccess);
        var dto = result.Data!.Single();
        Assert.Equal("Math", dto.CourseName);
        Assert.Equal(2, dto.DocumentCount);
    }

    [Fact]
    public async Task Handle_NoCourses_ReturnsEmptyCollection()
    {
        _courses.Setup(r => r.GetListItemsByUserAsync(_userId, default)).ReturnsAsync(Array.Empty<CourseListItem>());

        var result = await _handler.Handle(new GetAllCoursesQuery(_userId), default);

        Assert.True(result.IsSuccess);
        Assert.Empty(result.Data!);
    }
}
