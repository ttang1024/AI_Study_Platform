namespace StudyPlatform.Application.Courses.DTOs;

public record CreateCourseRequest(string CourseName, string CourseColor);

public record UpdateCourseRequest(string CourseName, string CourseColor);

public record CourseDto(
    Guid CourseId,
    Guid UserId,
    string CourseName,
    string CourseColor,
    int DocumentCount,
    DateTime CreatedAt,
    DateTime UpdatedAt);
