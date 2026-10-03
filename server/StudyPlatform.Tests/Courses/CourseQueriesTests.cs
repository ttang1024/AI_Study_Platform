using System.Linq.Expressions;
using Moq;
using StudyPlatform.Application.Courses.Queries;
using StudyPlatform.Domain.Entities;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Domain.Projections;
using Xunit;

namespace StudyPlatform.Tests.Courses;

public class GetCourseByIdQueryHandlerTests
{
    private readonly Mock<IUnitOfWork> _uow = new();
    private readonly Mock<ICourseRepository> _courses = new();
    private readonly Mock<IStudyGroupSharedCourseRepository> _shared = new();
    private readonly Mock<IStudyGroupMemberRepository> _members = new();
    private readonly GetCourseByIdQueryHandler _handler;
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _courseId = Guid.NewGuid();

    public GetCourseByIdQueryHandlerTests()
    {
        _uow.Setup(u => u.Courses).Returns(_courses.Object);
        _uow.Setup(u => u.StudyGroupSharedCourses).Returns(_shared.Object);
        _uow.Setup(u => u.StudyGroupMembers).Returns(_members.Object);
        _handler = new GetCourseByIdQueryHandler(_uow.Object);
    }

    private CourseListItem MakeItem(Guid userId) => new(_courseId, userId, "Algorithms", "#000", 3, DateTime.UtcNow, DateTime.UtcNow);

    [Fact]
    public async Task Handle_NotFound_ReturnsFailure()
    {
        _courses.Setup(r => r.GetListItemByIdAsync(_courseId, default)).ReturnsAsync((CourseListItem?)null);

        var result = await _handler.Handle(new GetCourseByIdQuery(_courseId, _userId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("COURSE_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_OwnedCourse_ReturnsIt()
    {
        _courses.Setup(r => r.GetListItemByIdAsync(_courseId, default)).ReturnsAsync(MakeItem(_userId));

        var result = await _handler.Handle(new GetCourseByIdQuery(_courseId, _userId), default);

        Assert.True(result.IsSuccess);
    }

    [Fact]
    public async Task Handle_NotOwnedNoGroupAccess_ReturnsNotFound()
    {
        _courses.Setup(r => r.GetListItemByIdAsync(_courseId, default)).ReturnsAsync(MakeItem(Guid.NewGuid()));
        _shared.Setup(r => r.FindAsync(It.IsAny<Expression<Func<StudyGroupSharedCourse, bool>>>(), default)).ReturnsAsync(Array.Empty<StudyGroupSharedCourse>());

        var result = await _handler.Handle(new GetCourseByIdQuery(_courseId, _userId), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("COURSE_NOT_FOUND", result.ErrorCode);
    }

    [Fact]
    public async Task Handle_NotOwnedWithGroupAccess_ReturnsIt()
    {
        var groupId = Guid.NewGuid();
        _courses.Setup(r => r.GetListItemByIdAsync(_courseId, default)).ReturnsAsync(MakeItem(Guid.NewGuid()));
        _shared.Setup(r => r.FindAsync(It.IsAny<Expression<Func<StudyGroupSharedCourse, bool>>>(), default))
            .ReturnsAsync(new[] { new StudyGroupSharedCourse { GroupId = groupId, CourseId = _courseId } });
        _members.Setup(r => r.ExistsAsync(It.IsAny<Expression<Func<StudyGroupMember, bool>>>(), default)).ReturnsAsync(true);

        var result = await _handler.Handle(new GetCourseByIdQuery(_courseId, _userId), default);

        Assert.True(result.IsSuccess);
    }
}
