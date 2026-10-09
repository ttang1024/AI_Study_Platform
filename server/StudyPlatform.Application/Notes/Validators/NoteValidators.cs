using FluentValidation;
using StudyPlatform.Application.Notes.Commands;

namespace StudyPlatform.Application.Notes.Validators;

/// <summary>
/// Title mirrors NoteConfiguration. Content is a text column of rich-text HTML that may embed images, so
/// it only gets a ceiling well above any real note — enough to stop a multi-megabyte junk payload.
/// </summary>
public class CreateNoteValidator : AbstractValidator<CreateNoteCommand>
{
    public CreateNoteValidator()
    {
        RuleFor(x => x.Title).MaximumLength(500);
        RuleFor(x => x.Content).NotNull().MaximumLength(NoteLimits.MaxContentLength);
    }
}

public class UpdateNoteValidator : AbstractValidator<UpdateNoteCommand>
{
    public UpdateNoteValidator()
    {
        RuleFor(x => x.Title).MaximumLength(500);
        RuleFor(x => x.Content).NotNull().MaximumLength(NoteLimits.MaxContentLength);
    }
}

internal static class NoteLimits
{
    public const int MaxContentLength = 5_000_000;
}
