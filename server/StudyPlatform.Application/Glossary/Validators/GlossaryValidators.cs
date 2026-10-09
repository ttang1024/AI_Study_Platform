using FluentValidation;
using StudyPlatform.Application.Glossary.Commands;

namespace StudyPlatform.Application.Glossary.Validators;

// Term mirrors GlossaryTermConfiguration; the definition is a text column, bounded generously.
public class UpdateGlossaryTermValidator : AbstractValidator<UpdateGlossaryTermCommand>
{
    public UpdateGlossaryTermValidator()
    {
        RuleFor(x => x.Term).NotEmpty().MaximumLength(500);
        RuleFor(x => x.Definition).NotNull().MaximumLength(20_000);
    }
}
