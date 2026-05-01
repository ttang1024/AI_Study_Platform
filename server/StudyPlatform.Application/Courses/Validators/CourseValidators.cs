using FluentValidation;
using StudyPlatform.Application.Courses.Commands;

namespace StudyPlatform.Application.Courses.Validators;

public class CreateCourseValidator : AbstractValidator<CreateCourseCommand>
{
    public CreateCourseValidator()
    {
        RuleFor(x => x.CourseName)
            .NotEmpty().WithMessage("Course name is required.")
            .MaximumLength(200).WithMessage("Course name must not exceed 200 characters.");

        RuleFor(x => x.CourseColor)
            .NotEmpty().WithMessage("Course color is required.")
            .Matches("^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$").WithMessage("Course color must be a valid hex color.");
    }
}

public class UpdateCourseValidator : AbstractValidator<UpdateCourseCommand>
{
    public UpdateCourseValidator()
    {
        RuleFor(x => x.CourseName)
            .NotEmpty().WithMessage("Course name is required.")
            .MaximumLength(200).WithMessage("Course name must not exceed 200 characters.");

        RuleFor(x => x.CourseColor)
            .NotEmpty().WithMessage("Course color is required.")
            .Matches("^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$").WithMessage("Course color must be a valid hex color.");
    }
}
