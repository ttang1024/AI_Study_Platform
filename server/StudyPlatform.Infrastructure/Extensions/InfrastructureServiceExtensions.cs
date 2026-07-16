using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using StudyPlatform.Application.Services;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Infrastructure.Data;
using StudyPlatform.Infrastructure.Http;
using StudyPlatform.Infrastructure.Repositories;
using StudyPlatform.Infrastructure.Services;

namespace StudyPlatform.Infrastructure.Extensions;

public static class InfrastructureServiceExtensions
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        // Database
        services.AddDbContext<AppDbContext>(options =>
        {
            var connectionString = configuration.GetConnectionString("DefaultConnection")
                ?? throw new InvalidOperationException("Database connection string 'DefaultConnection' is not configured.");
            options.UseNpgsql(connectionString, npgsqlOptions =>
            {
                npgsqlOptions.EnableRetryOnFailure(
                    maxRetryCount: 5,
                    maxRetryDelay: TimeSpan.FromSeconds(30),
                    errorCodesToAdd: null);

                // Maps ContentEmbedding.Embedding to pgvector's vector type and enables the
                // distance operators (<=>) that semantic search orders by.
                npgsqlOptions.UseVector();
            });
        });

        // Unit of Work
        services.AddScoped<IUnitOfWork, UnitOfWork>();

        // Admin platform-wide analytics (reads across all users; admin-only endpoints)
        services.AddScoped<IAdminAnalyticsRepository, AdminAnalyticsRepository>();

        // Unified library list (documents + videos merged, server-paginated)
        services.AddScoped<ILibraryRepository, LibraryRepository>();

        // Services
        services.AddScoped<ITokenService, TokenService>();
        services.AddScoped<IEmailService, EmailService>();
        services.AddScoped<IBlobStorageService, S3BlobStorageService>();
        services.AddScoped<IDocumentTextExtractor, DocumentTextExtractorService>();
        services.AddScoped<IDocumentContentService, DocumentContentService>();
        services.AddScoped<IPasswordHasher, PasswordHasher>();
        services.AddSingleton<IAnkiExportService, AnkiExportService>();
        services.AddSingleton<ITtsSynthesisService, EdgeTtsService>();
        services.AddSingleton<IAppCache, DistributedAppCache>();
        // Token accounting for every AI call. Singleton: it opens its own scope per write so usage
        // rows never enlist in the caller's unit of work.
        services.AddSingleton<IAiUsageRecorder, AiUsageRecorder>();
        // External ICS calendars ("secret address" feeds) for planner busy-time import.
        // User-supplied URL → SSRF-guarded handler that refuses private/loopback/metadata addresses
        // on the initial request and every redirect hop.
        services.AddHttpClient<ICalendarFeedService, CalendarFeedService>(client =>
        {
            client.Timeout = TimeSpan.FromSeconds(20);
            client.DefaultRequestHeaders.Add("User-Agent", "StudyPlatform");
        })
        .ConfigurePrimaryHttpMessageHandler(() => SsrfGuard.CreateHandler());
        // Push notifications — the HttpClient delivers to Expo's push API for
        // native-device tokens; browser Web Push goes through the WebPush library.
        services.AddHttpClient<IPushNotificationService, WebPushNotificationService>(client =>
        {
            client.Timeout = TimeSpan.FromSeconds(15);
        });

        // HTTP context accessor (used by AiService to read request headers)
        services.AddHttpContextAccessor();

        // Whisper (singleton — model is loaded once and reused across requests)
        services.AddSingleton<ITranscriptionService, WhisperTranscriptionService>();

        // AI HTTP Client
        services.AddHttpClient<IAiService, AiService>(client =>
        {
            client.Timeout = TimeSpan.FromSeconds(120);
        });

        // Semantic search. Configured independently of the per-user chat provider: the backfill worker
        // indexes outside any request, and Anthropic/DeepSeek publish no embeddings API at all.
        services.AddHttpClient<IEmbeddingService, EmbeddingService>(client =>
        {
            client.Timeout = TimeSpan.FromSeconds(60);
        });
        services.AddScoped<IEmbeddingIndex, EmbeddingIndex>();

        // YouTubeCredentialPool: singleton so failure state is shared across all requests.
        services.AddSingleton<YouTubeCredentialPool>();

        // YouTube Transcript — HttpClient is used only to fetch subtitle CDN URLs after
        // yt-dlp resolves them. Proxy/cookie rotation is handled by YouTubeCredentialPool.
        services.AddHttpClient<IYouTubeTranscriptService, YouTubeTranscriptService>(client =>
        {
            client.Timeout = GetConfiguredTimeout(configuration, "YouTube:HttpTimeoutSeconds", 60);
        });

        // OAuth Service
        services.AddHttpClient<IOAuthService, OAuthService>(client =>
        {
            client.DefaultRequestHeaders.Add("User-Agent", "StudyPlatform");
            client.DefaultRequestHeaders.Accept.Add(new System.Net.Http.Headers.MediaTypeWithQualityHeaderValue("application/json"));
        });

        // Podcast Episode Service — browser-like UA because many podcast platforms
        // (Overcast, Podbean, …) block generic HTTP clients from episode pages
        services.AddHttpClient<IPodcastEpisodeService, PodcastEpisodeService>(client =>
        {
            client.Timeout = TimeSpan.FromSeconds(30);
            client.DefaultRequestHeaders.Add("User-Agent",
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
        })
        .ConfigurePrimaryHttpMessageHandler(() => SsrfGuard.CreateHandler());

        // Web Clipper — used by ClipUrl to fetch article HTML server-side
        services.AddHttpClient("WebClipper", client =>
        {
            client.Timeout = TimeSpan.FromSeconds(30);
            client.DefaultRequestHeaders.Add("User-Agent",
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
        })
        .ConfigurePrimaryHttpMessageHandler(() => SsrfGuard.CreateHandler());

        return services;
    }

    private static TimeSpan GetConfiguredTimeout(IConfiguration configuration, string key, int defaultSeconds)
    {
        if (!int.TryParse(configuration[key], out var seconds) || seconds <= 0)
            return TimeSpan.FromSeconds(defaultSeconds);

        return TimeSpan.FromSeconds(seconds);
    }
}
