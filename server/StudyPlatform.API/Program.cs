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
using StackExchange.Redis;
using StudyPlatform.API.HealthChecks;
using StudyPlatform.API.Hubs;
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
builder.Services.AddControllers();
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

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
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
var redisEnabled = builder.Configuration.GetValue("Redis:Enabled", false);
var redisConnectionString = builder.Configuration.GetConnectionString("Redis")
    ?? builder.Configuration["Redis:ConnectionString"];
if (redisEnabled)
{
    if (TryGetRedisConfiguration(redisConnectionString, out var redisConfiguration, out var redisConfigurationError))
    {
        ConfigureRedisTimeouts(redisConfiguration!, builder.Configuration);

        builder.Services.AddStackExchangeRedisCache(options =>
        {
            options.ConfigurationOptions = redisConfiguration;
            options.InstanceName = builder.Configuration["Redis:InstanceName"] ?? "StudyPlatform:";
        });
    }
    else
    {
        if (!string.IsNullOrWhiteSpace(redisConnectionString))
        {
            Console.Error.WriteLine($"Redis cache disabled: {redisConfigurationError}");
        }

        builder.Services.AddDistributedMemoryCache();
    }
}
else
{
    builder.Services.AddDistributedMemoryCache();
}

// Keep rate limiting process-local so Redis outages or bad Redis settings do not
// turn ordinary API requests into 500s.
builder.Services.AddInMemoryRateLimiting();
builder.Services.Configure<IpRateLimitOptions>(builder.Configuration.GetSection("IpRateLimiting"));
builder.Services.AddSingleton<IRateLimitConfiguration, RateLimitConfiguration>();

// SignalR
builder.Services.AddSignalR();
builder.Services.AddSingleton<AudioTranscriptionQueue>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<AudioTranscriptionQueue>());
builder.Services.AddSingleton<AudioOverviewQueue>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<AudioOverviewQueue>());
builder.Services.AddSingleton<AiJobQueue>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<AiJobQueue>());

// Application and Infrastructure layers
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.Configure<AppLimitsOptions>(builder.Configuration.GetSection(AppLimitsOptions.SectionName));
builder.Services.Configure<CacheOptions>(builder.Configuration.GetSection(CacheOptions.SectionName));
builder.Services.Configure<VapidOptions>(builder.Configuration.GetSection(VapidOptions.SectionName));
builder.Services.Configure<AiUsageOptions>(builder.Configuration.GetSection(AiUsageOptions.SectionName));
builder.Services.Configure<EmbeddingOptions>(builder.Configuration.GetSection(EmbeddingOptions.SectionName));

// Keeps the semantic index in step with the library (no-op until Embeddings:ApiKey is configured).
builder.Services.AddHostedService<EmbeddingBackfillWorker>();

// Daily "cards due" web-push reminders (no-op until VAPID keys are configured).
builder.Services.AddHostedService<DueReviewPushWorker>();

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

// Apply EF Core migrations on startup
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();

    // The AI job queue is in-process, so a restart drops whatever was queued or mid-run. Those jobs
    // are never coming back — fail them so the UI stops showing a spinner that will never resolve.
    var jobs = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();
    var interrupted = await jobs.AiJobs.FailInterruptedAsync("Interrupted by a server restart. Please try again.");
    if (interrupted > 0)
        app.Logger.LogWarning("Failed {Count} AI job(s) left in flight by a previous shutdown", interrupted);
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

static bool TryGetRedisConfiguration(
    string? connectionString,
    out ConfigurationOptions? configuration,
    out string? error)
{
    configuration = null;
    error = null;

    if (string.IsNullOrWhiteSpace(connectionString))
        return false;

    try
    {
        configuration = ConfigurationOptions.Parse(connectionString);
        configuration.AbortOnConnectFail = false;

        if (configuration.EndPoints.Count == 0)
        {
            error = "no Redis endpoints were configured.";
            configuration = null;
            return false;
        }

        foreach (var endpoint in configuration.EndPoints)
        {
            if (endpoint is System.Net.DnsEndPoint dnsEndpoint
                && string.IsNullOrWhiteSpace(dnsEndpoint.Host.Trim(':')))
            {
                error = $"invalid Redis endpoint '{dnsEndpoint.Host}:{dnsEndpoint.Port}'.";
                configuration = null;
                return false;
            }
        }

        return true;
    }
    catch (Exception ex) when (ex is ArgumentException or FormatException)
    {
        error = ex.Message;
        configuration = null;
        return false;
    }
}

static void ConfigureRedisTimeouts(ConfigurationOptions configuration, IConfiguration appConfiguration)
{
    configuration.ConnectTimeout = GetConfiguredMilliseconds(appConfiguration, "Redis:ConnectTimeoutMilliseconds", 1000);
    configuration.AsyncTimeout = GetConfiguredMilliseconds(appConfiguration, "Redis:AsyncTimeoutMilliseconds", 1000);
    configuration.SyncTimeout = GetConfiguredMilliseconds(appConfiguration, "Redis:SyncTimeoutMilliseconds", 1000);
}

static int GetConfiguredMilliseconds(IConfiguration configuration, string key, int defaultMilliseconds)
{
    return int.TryParse(configuration[key], out var milliseconds) && milliseconds > 0
        ? milliseconds
        : defaultMilliseconds;
}
