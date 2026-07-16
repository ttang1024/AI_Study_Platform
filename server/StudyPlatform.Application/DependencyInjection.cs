using FluentValidation;
using MediatR;
using Microsoft.Extensions.DependencyInjection;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Flashcards;
using StudyPlatform.Application.Practice;
using StudyPlatform.Application.Services;

namespace StudyPlatform.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddMediatR(cfg =>
        {
            cfg.RegisterServicesFromAssembly(typeof(DependencyInjection).Assembly);
        });

        services.AddValidatorsFromAssembly(typeof(DependencyInjection).Assembly);

        services.AddTransient(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));

        // Picks a quiz's difficulty and focus from the learner's history — pure logic over the
        // unit of work, so it lives in Application rather than Infrastructure.
        services.AddScoped<IAdaptiveQuizPlanner, AdaptiveQuizPlanner>();

        // Drops generated cards that restate one the user already has. Composes the embedding
        // abstractions rather than talking to pgvector itself, so it belongs here too.
        services.AddScoped<IFlashcardDeduplicator, FlashcardDeduplicator>();

        return services;
    }
}
