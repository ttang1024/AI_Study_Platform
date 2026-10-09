using FluentValidation;
using StudyPlatform.Application.Calendar;

namespace StudyPlatform.Application.Calendar.Validators;

// Lengths mirror UserCalendarFeedConfiguration. The URL's scheme is checked by the handler itself
// (INVALID_URL), which also normalises webcal:// before fetching.
public class AddCalendarFeedValidator : AbstractValidator<AddCalendarFeedCommand>
{
    public AddCalendarFeedValidator()
    {
        RuleFor(x => x.Name).MaximumLength(200);
        RuleFor(x => x.Url).NotEmpty().MaximumLength(2000);
    }
}
