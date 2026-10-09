using FluentValidation;
using StudyPlatform.Application.Feedback.Commands;

namespace StudyPlatform.Application.Feedback.Validators;

// Limits mirror FeedbackConfiguration; without them an oversized value fails inside SaveChanges as a 500.
public class SubmitFeedbackValidator : AbstractValidator<SubmitFeedbackCommand>
{
    public SubmitFeedbackValidator()
    {
        RuleFor(x => x.Type).NotEmpty().MaximumLength(20);
        RuleFor(x => x.Subject).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Message).NotEmpty().MaximumLength(10_000);
        RuleFor(x => x.Rating).InclusiveBetween(1, 5).When(x => x.Rating.HasValue);
        RuleFor(x => x.UserEmail).MaximumLength(256).EmailAddress().When(x => !string.IsNullOrEmpty(x.UserEmail));
    }
}
