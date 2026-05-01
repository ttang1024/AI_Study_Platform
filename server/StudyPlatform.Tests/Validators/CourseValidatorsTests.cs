using FluentValidation.TestHelper;
using StudyPlatform.Application.Courses.Commands;
using StudyPlatform.Application.Courses.Validators;
using Xunit;

namespace StudyPlatform.Tests.Validators;

public class CreateCourseValidatorTests
{
    private readonly CreateCourseValidator _validator = new();

    private static CreateCourseCommand Valid() =>
        new(Guid.NewGuid(), "Algorithms 101", "#3B82F6");

    [Fact]
    public void Valid_Command_PassesValidation()
    {
        _validator.TestValidate(Valid()).ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Empty_CourseName_FailsValidation()
    {
        _validator.TestValidate(Valid() with { CourseName = "" })
            .ShouldHaveValidationErrorFor(x => x.CourseName);
    }

    [Fact]
    public void CourseName_Over200Chars_FailsValidation()
    {
        var longName = new string('A', 201);
        _validator.TestValidate(Valid() with { CourseName = longName })
            .ShouldHaveValidationErrorFor(x => x.CourseName);
    }

    [Theory]
    [InlineData("")]
    [InlineData("red")]           // not hex
    [InlineData("#GGGGGG")]       // invalid hex chars
    [InlineData("#12345")]        // 5 digits
    [InlineData("3B82F6")]        // missing #
    public void Invalid_HexColor_FailsValidation(string color)
    {
        _validator.TestValidate(Valid() with { CourseColor = color })
            .ShouldHaveValidationErrorFor(x => x.CourseColor);
    }

    [Theory]
    [InlineData("#3B82F6")]   // 6-digit hex
    [InlineData("#fff")]      // 3-digit hex lowercase
    [InlineData("#ABC")]      // 3-digit hex uppercase
    [InlineData("#aabbcc")]   // 6-digit hex lowercase
    public void Valid_HexColor_PassesValidation(string color)
    {
        _validator.TestValidate(Valid() with { CourseColor = color })
            .ShouldNotHaveValidationErrorFor(x => x.CourseColor);
    }
}

public class UpdateCourseValidatorTests
{
    private readonly UpdateCourseValidator _validator = new();

    private static UpdateCourseCommand Valid() =>
        new(Guid.NewGuid(), Guid.NewGuid(), "Updated Course", "#FF5733");

    [Fact]
    public void Valid_Command_PassesValidation()
    {
        _validator.TestValidate(Valid()).ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Empty_CourseName_FailsValidation()
    {
        _validator.TestValidate(Valid() with { CourseName = "" })
            .ShouldHaveValidationErrorFor(x => x.CourseName);
    }

    [Fact]
    public void CourseName_Over200Chars_FailsValidation()
    {
        var longName = new string('B', 201);
        _validator.TestValidate(Valid() with { CourseName = longName })
            .ShouldHaveValidationErrorFor(x => x.CourseName);
    }

    [Theory]
    [InlineData("")]
    [InlineData("notahex")]
    [InlineData("#ZZZZZZ")]
    public void Invalid_HexColor_FailsValidation(string color)
    {
        _validator.TestValidate(Valid() with { CourseColor = color })
            .ShouldHaveValidationErrorFor(x => x.CourseColor);
    }
}
