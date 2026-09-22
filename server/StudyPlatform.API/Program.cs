using System.IO.Compression;
using System.Text;
using AspNetCoreRateLimit;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.EntityFrameworkCore;
using StudyPlatform.Infrastructure.Data;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using StudyPlatform.API.Extensions;
using StudyPlatform.API.HealthChecks;
using StudyPlatform.API.Hubs;
using StudyPlatform.API.Json;
using StudyPlatform.API.Middleware;
using StudyPlatform.API.Services;
using StudyPlatform.Application;
using StudyPlatform.Application.Settings;
using StudyPlatform.Domain.Interfaces;
using StudyPlatform.Infrastructure.Extensions;

var builder = WebApplication.CreateBuilder(args);

// Compress JSON responses — deployments sit behind an ALB / ingress that doesn't
// compress, and payloads like transcripts, summaries, and library pages shrink
// 5–10x under Brotli. SSE (text/event-stream) is not in the MIME list, so
// streaming endpoints pass through untouched; SignalR websockets are unaffected.
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<BrotliCompressionProvider>();
    options.Providers.Add<GzipCompressionProvider>();
    options.MimeTypes = ResponseCompressionDefaults.MimeTypes;
});
builder.Services.Configure<BrotliCompressionProviderOptions>(o => o.Level = CompressionLevel.Fastest);
builder.Services.Configure<GzipCompressionProviderOptions>(o => o.Level = CompressionLevel.Fastest);

// Add services to the container
builder.Services.AddControllers()
    // Timestamp columns are timestamptz, which Npgsql will only write from a UTC DateTime.
    // Coerce on the way in so an unzoned client value (a date picker's "2026-08-10") can't
    // reach SaveChangesAsync and 500 there.
    .AddJsonOptions(options => options.JsonSerializerOptions.Converters.Add(new UtcDateTimeConverter()));
builder.Services.AddEndpointsApiExplorer();

// Swagger / OpenAPI
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "StudyPlatform API",
        Version = "v1",
        Description = "AI-powered learning platform API",
        Contact = new OpenApiContact
        {
            Name = "StudyPlatform Team",
            Email = "support@studyplatform.com"
        }
    });

    // JWT Bearer auth in Swagger
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme. Example: \"Bearer {token}\"",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });

    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

// JWT Authentication
var jwtSettings = builder.Configuration.GetSection("JwtSettings");
var secretKey = jwtSettings["SecretKey"] ?? throw new InvalidOperationException("JWT SecretKey not configured.");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey)),
        ValidateIssuer = true,
        ValidIssuer = jwtSettings["Issuer"] ?? "StudyPlatform",
        ValidateAudience = true,
        ValidAudience = jwtSettings["Audience"] ?? "StudyPlatformUsers",
        ValidateLifetime = true,
        ClockSkew = TimeSpan.Zero
    };

    options.Events = new JwtBearerEvents
    {
        // SignalR WebSocket connections pass the token as a query parameter
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            if (!string.IsNullOrEmpty(accessToken) &&
                context.HttpContext.Request.Path.StartsWithSegments("/hubs"))
            {
                context.Token = accessToken;
            }
            return Task.CompletedTask;
        },
        OnAuthenticationFailed = context =>
        {
            if (context.Exception is SecurityTokenExpiredException)
                context.Response.Headers.Append("Token-Expired", "true");
            return Task.CompletedTask;
        }
    };
});

builder.Services.AddAuthorization();

// CORS
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? new[] { "http://localhost:3000" };

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        if (builder.Environment.IsDevelopment())
        {
            policy.SetIsOriginAllowed(origin =>
                {
                    var uri = new Uri(origin);
                    return uri.Host == "localhost" || uri.Host == "127.0.0.1";
                })
                .AllowAnyHeader()
                .AllowAnyMethod()
                .AllowCredentials();
        }
        else
        {
            policy.WithOrigins(allowedOrigins)
                .AllowAnyHeader()
                .AllowAnyMethod()
                .AllowCredentials();
        }
    });
});

// Rate Limiting
builder.Services.AddMemoryCache();

// Redis is optional and off by default (Redis:Enabled=false). When it is off nothing in the process
// touches StackExchange.Redis: no connection multiplexer, no connection string requirement, no socket.
// The cache falls through to the Postgres CacheEntries tier and SignalR keeps its in-memory lifetime
// manager, so the API starts and serves normally with no Redis deployed anywhere.
var redis = RedisServiceExtensions.ResolveRedisConnection(builder.Configuration);
builder.Services.AddApplicationCache(builder.Configuration, redis);

// Keep rate limiting process-local so Redis outages or bad Redis settings do not
// turn ordinary API requests into 500s.
builder.Services.AddInMemoryRateLimiting();
builder.Services.Configure<IpRateLimitOptions>(builder.Configuration.GetSection("IpRateLimiting"));
builder.Services.AddSingleton<IRateLimitConfiguration, RateLimitConfiguration>();

// SignalR, plus the Redis backplane when Redis is enabled and answering. Without one, a hub message
// only reaches the clients connected to the replica that produced it, so group chat silently
// half-works when scaled out.
var backplaneUnavailableReason = builder.Services.AddApplicationSignalR(builder.Configuration, redis);

if (backplaneUnavailableReason != null && builder.Configuration.GetValue("Api:RequireScaleOutBackplane", false))
{
    // Opt-in guard for multi-replica deployments: failing to start is far better than starting and
    // delivering chat messages to only the third of users who happen to share a replica.
    throw new InvalidOperationException(
        $"Api:RequireScaleOutBackplane is set but {backplaneUnavailableReason}. SignalR needs a "
        + "backplane to run more than one API replica.");
}

if (backplaneUnavailableReason != null && redis.Enabled)
{
    Console.Error.WriteLine(
        $"SignalR Redis backplane disabled: {backplaneUnavailableReason}. Real-time messages will "
        + "reach only clients on this instance — fine for a single replica, not for scale-out. "
        + "Set Api:RequireScaleOutBackplane=true to make this a startup failure instead.");
}
builder.Services.AddSingleton<AudioTranscriptionQueue>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<AudioTranscriptionQueue>());

// Application and Infrastructure layers
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration, builder.Environment.IsProduction());
builder.Services.Configure<AppLimitsOptions>(builder.Configuration.GetSection(AppLimitsOptions.SectionName));
builder.Services.Configure<CacheOptions>(builder.Configuration.GetSection(CacheOptions.SectionName));
builder.Services.Configure<VapidOptions>(builder.Configuration.GetSection(VapidOptions.SectionName));
builder.Services.Configure<AiUsageOptions>(builder.Configuration.GetSection(AiUsageOptions.SectionName));
builder.Services.Configure<EmbeddingOptions>(builder.Configuration.GetSection(EmbeddingOptions.SectionName));

// Keeps the semantic index in step with the library (no-op until Embeddings:ApiKey is configured).
builder.Services.AddHostedService<EmbeddingBackfillWorker>();

// Daily "cards due" web-push reminders (no-op until VAPID keys are configured).
builder.Services.AddHostedService<DueReviewPushWorker>();

// Builds queued "download my data" archives. Safe on every replica: exports carry no per-caller
// credentials, and the Pending → Running claim is conditional, so two instances cannot build one twice.
builder.Services.AddHostedService<DataExportWorker>();

// Erases accounts once their deletion grace period expires.
builder.Services.AddHostedService<AccountDeletionWorker>();

// Trims the page-view table to its retention window. Safe on every replica: the delete is
// idempotent, so a second instance sweeping the same rows finds nothing left to do.
builder.Services.AddHostedService<PageVisitRetentionWorker>();

// Health checks.
//
// Split by intent, because the probes mean different things. Liveness asks "is this process wedged?" —
// it must not depend on Postgres, or a database outage would make Kubernetes kill and restart every pod
// in a loop that cannot possibly fix the database. Readiness asks "can this pod serve traffic?", which
// does depend on Postgres.
//
// Tagged rather than split into two AddHealthChecks() calls so both endpoints share one registration.
builder.Services.AddHealthChecks()
    .AddCheck<DatabaseHealthCheck>("postgres", tags: ["ready"])
    .AddCheck<CacheHealthCheck>("cache", tags: ["ready"]);

var app = builder.Build();

// Apply EF Core migrations on startup.
//
// Migrate() only applies pending migrations — it never drops or recreates the database. It stays on by
// default because it is this project's migration workflow and the only thing that keeps a single-task
// deployment's schema in step with its image. Set Database:MigrateOnStartup=false to take that out of
// the request path — for example to run `dotnet ef database update` as a one-off ECS task before the
// service rolls, which is what you want once more than one task starts at a time (concurrent
// Migrate() calls race on the migrations-history lock) or once a migration is long enough to blow the
// load balancer's health-check grace period.
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    if (app.Configuration.GetValue("Database:MigrateOnStartup", true))
    {
        db.Database.Migrate();
    }
    else
    {
        var pending = (await db.Database.GetPendingMigrationsAsync()).ToArray();
        if (pending.Length > 0)
        {
            app.Logger.LogWarning(
                "Database:MigrateOnStartup is false and {Count} migration(s) have not been applied ({Migrations}). "
                + "Run `dotnet ef database update` against this database before serving traffic.",
                pending.Length,
                string.Join(", ", pending));
        }
    }
}

// Middleware pipeline
app.UseResponseCompression();
app.UseCors("AllowFrontend");
app.UseMiddleware<RequestLoggingMiddleware>();
app.UseMiddleware<GlobalExceptionHandlerMiddleware>();

app.UseSwagger();
app.UseSwaggerUI(options =>
{
    options.SwaggerEndpoint("/swagger/v1/swagger.json", "StudyPlatform API v1");
    options.RoutePrefix = "swagger";
});

if (app.Environment.IsDevelopment())
    app.UseHttpsRedirection();
app.UseIpRateLimiting();
app.UseAuthentication();
app.UseAuthorization();

// After authentication so the caller's identity is known: resolves their plan once per request and
// leaves it on the HttpContext for the hosted-key and quota paths, which cannot await.

app.MapControllers();
app.MapHub<GroupChatHub>("/hubs/group-chat");
// Liveness: no dependency checks, by design (see the registration above). If the process can route a
// request it is alive; restarting it would not fix a sick dependency.
app.MapHealthChecks("/health", new HealthCheckOptions { Predicate = _ => false });

// Readiness: Postgres must answer (Unhealthy → 503 → pod leaves the load balancer). A cache outage
// reports Degraded, which is still a 200 — IAppCache falls back to the Postgres cache tier, so the pod
// keeps serving. That mapping is what keeps a Redis blip from becoming an API outage.
app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready"),
    ResponseWriter = HealthCheckResponse.WriteAsync,
});
app.MapGet("/", () => Results.Ok());

app.Run();
