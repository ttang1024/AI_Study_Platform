using FluentValidation;
using StudyPlatform.Application.Analytics.Commands;

namespace StudyPlatform.Application.Analytics.Validators;

/// <summary>
/// Guards the one endpoint anybody on the internet can write to. The rules are about shape and
/// size only — the columns are short, and a beacon that does not look like one is not worth a row.
/// </summary>
public class RecordPageVisitValidator : AbstractValidator<RecordPageVisitCommand>
{
    public RecordPageVisitValidator()
    {
        RuleFor(x => x.Path)
            .Cascade(CascadeMode.Stop)
            .NotEmpty().WithMessage("Path is required.")
            .Must(p => p.StartsWith('/')).WithMessage("Path must be site-relative.")
            .MaximumLength(2048).WithMessage("Path is too long.");

        RuleFor(x => x.VisitorId)
            .NotEmpty().WithMessage("Visitor id is required.")
            .MaximumLength(64).WithMessage("Visitor id is too long.");

        RuleFor(x => x.SessionId)
            .NotEmpty().WithMessage("Session id is required.")
            .MaximumLength(64).WithMessage("Session id is too long.");

        RuleFor(x => x.Referrer)
            .MaximumLength(2048).WithMessage("Referrer is too long.");
    }
}
