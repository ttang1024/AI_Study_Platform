using FluentValidation;
using MediatR;
using Microsoft.Extensions.DependencyInjection;
using StudyPlatform.Application.Auth;
using StudyPlatform.Application.Chat;
using StudyPlatform.Application.Common;
using StudyPlatform.Application.Documents;
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

        // Owns the tail every sign-in path shares — mint access token, persist the refresh-token
        // row, save — so those paths cannot drift apart on session identity or token lifetime.
        services.AddScoped<IAuthSessionIssuer, AuthSessionIssuer>();

        // Find-or-provision the local account behind a verified external identity, so the provider
        // handlers differ only in which provider vouched.
        services.AddScoped<IExternalSignIn, ExternalSignIn>();

        // Saves the user and assistant halves of a streamed chat turn, so document, video and
        // standalone chat cannot write differently shaped history.
        services.AddScoped<IChatTurnRecorder, ChatTurnRecorder>();

        // Records a quiz attempt, for a document or a video, into the same row shape and the same
        // mistakes notebook.
        services.AddScoped<IQuizSubmissionWriter, QuizSubmissionWriter>();

        // The documents-and-videos feed the "what can I generate from?" screens share.
        services.AddScoped<IStudyMaterialLookup, StudyMaterialLookup>();

        // Picks a quiz's difficulty and focus from the learner's history — pure logic over the
        // unit of work, so it lives in Application rather than Infrastructure.
        services.AddScoped<IAdaptiveQuizPlanner, AdaptiveQuizPlanner>();

        // Drops generated cards that restate one the user already has. Composes the embedding
        // abstractions rather than talking to pgvector itself, so it belongs here too.
        services.AddScoped<IFlashcardDeduplicator, FlashcardDeduplicator>();

        // Fits FSRS weights to a user's own review log. Stateless number-crunching over rows the
        // handler hands it, so it has no infrastructure dependency of its own.
        services.AddSingleton<IFsrsOptimizer, FsrsOptimizer>();

        // Owns "which settings does this user schedule with, and which day is quietest" so the
        // review handler stays a handler.
        services.AddScoped<IReviewScheduler, ReviewScheduler>();

        return services;
    }
}
