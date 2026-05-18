using System.Text;
using AspNetCoreRateLimit;
using Microsoft.EntityFrameworkCore;
using StudyPlatform.Infrastructure.Data;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using StackExchange.Redis;
using StudyPlatform.API.Hubs;
using StudyPlatform.API.Middleware;
using StudyPlatform.Application;
using StudyPlatform.Application.Settings;
using StudyPlatform.Infrastructure.Extensions;

var builder = WebApplication.CreateBuilder(args);

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

// Application and Infrastructure layers
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.Configure<AppLimitsOptions>(builder.Configuration.GetSection(AppLimitsOptions.SectionName));
builder.Services.Configure<CacheOptions>(builder.Configuration.GetSection(CacheOptions.SectionName));

// Health checks
builder.Services.AddHealthChecks();

var app = builder.Build();

// Apply EF Core migrations on startup
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();
}

// Middleware pipeline
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

app.UseCors("AllowFrontend");
app.UseIpRateLimiting();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<GroupChatHub>("/hubs/group-chat");
app.MapHealthChecks("/health");
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
