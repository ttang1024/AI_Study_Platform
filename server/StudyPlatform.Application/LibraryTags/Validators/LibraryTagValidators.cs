using FluentValidation;
using StudyPlatform.Application.LibraryTags.Commands;

namespace StudyPlatform.Application.LibraryTags.Validators;

// Limits mirror LibraryTagConfiguration.
public class CreateLibraryTagValidator : AbstractValidator<CreateLibraryTagCommand>
{
    public CreateLibraryTagValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(64);
        RuleFor(x => x.Kind).NotEmpty().MaximumLength(16);
        RuleFor(x => x.Color).MaximumLength(16);
        RuleFor(x => x.Description).MaximumLength(512);
    }
}

public class UpdateLibraryTagValidator : AbstractValidator<UpdateLibraryTagCommand>
{
    public UpdateLibraryTagValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(64);
        RuleFor(x => x.Color).MaximumLength(16);
        RuleFor(x => x.Description).MaximumLength(512);
    }
}
