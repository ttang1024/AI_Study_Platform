using FluentValidation;
using StudyPlatform.Application.Common;
using Xunit;

namespace StudyPlatform.Tests.Common;

public class ValidationBehaviorTests
{
    private record TestRequest(string Name);

    [Fact]
    public async Task Handle_NoValidators_CallsNext()
    {
        var behavior = new ValidationBehavior<TestRequest, string>(Array.Empty<IValidator<TestRequest>>());
        var called = false;

        var result = await behavior.Handle(new TestRequest("x"), () =>
        {
            called = true;
            return Task.FromResult("ok");
        }, default);

        Assert.True(called);
        Assert.Equal("ok", result);
    }

    [Fact]
    public async Task Handle_ValidatorPasses_CallsNext()
    {
        var validator = new InlineValidator<TestRequest>();
        validator.RuleFor(r => r.Name).NotEmpty();
        var behavior = new ValidationBehavior<TestRequest, string>(new[] { validator });

        var result = await behavior.Handle(new TestRequest("valid"), () => Task.FromResult("ok"), default);

        Assert.Equal("ok", result);
    }

    [Fact]
    public async Task Handle_ValidatorFails_ThrowsValidationException()
    {
        var validator = new InlineValidator<TestRequest>();
        validator.RuleFor(r => r.Name).NotEmpty();
        var behavior = new ValidationBehavior<TestRequest, string>(new[] { validator });

        await Assert.ThrowsAsync<ValidationException>(() =>
            behavior.Handle(new TestRequest(""), () => Task.FromResult("ok"), default));
    }

    [Fact]
    public async Task Handle_MultipleValidatorsFail_AggregatesAllFailures()
    {
        var validator1 = new InlineValidator<TestRequest>();
        validator1.RuleFor(r => r.Name).NotEmpty().WithMessage("Name required");
        var validator2 = new InlineValidator<TestRequest>();
        validator2.RuleFor(r => r.Name).MinimumLength(10).WithMessage("Too short");

        var behavior = new ValidationBehavior<TestRequest, string>(new[] { validator1, validator2 });

        var ex = await Assert.ThrowsAsync<ValidationException>(() =>
            behavior.Handle(new TestRequest(""), () => Task.FromResult("ok"), default));

        Assert.Contains(ex.Errors, e => e.ErrorMessage == "Too short");
    }

    [Fact]
    public async Task Handle_ValidatorWithNoFailures_DoesNotThrow()
    {
        var validator = new InlineValidator<TestRequest>();
        validator.RuleFor(r => r.Name).NotEmpty();
        var behavior = new ValidationBehavior<TestRequest, string>(new[] { validator });
        var wasCalled = false;

        await behavior.Handle(new TestRequest("ok"), () =>
        {
            wasCalled = true;
            return Task.FromResult("done");
        }, default);

        Assert.True(wasCalled);
    }
}
