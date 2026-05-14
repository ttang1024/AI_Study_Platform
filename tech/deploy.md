# Deployment

## Scripts

| Script | Purpose |
| --- | --- |
| `deploy.sh` | Full Azure deployment |
| `deploy-backend.sh` | API/backend redeploy |
| `deploy-web.sh` | Web frontend redeploy |
| `deploy-app.sh` | App deployment helper |
| `generate-proxy-env.sh` | YouTube proxy env helper |
| `generate-cookies-env.sh` | YouTube cookie env helper |
| `load-env.sh` | Load local env file |

## Backend Runtime Requirements

- PostgreSQL connection string
- JWT settings
- CORS origins
- Redis optional but supported
- Azure Blob Storage for production file storage
- SMTP settings for OTP email
- AI provider settings supplied by users through request headers
- YouTube proxy/cookie settings when cloud IPs are blocked by YouTube

## Runtime Configuration (Program.cs)

Key server-side settings required at runtime:

| Config key | Purpose |
| --- | --- |
| `ConnectionStrings:DefaultConnection` | PostgreSQL (required) |
| `JwtSettings:SecretKey`, `Issuer`, `Audience` | JWT signing and validation |
| `Cors:AllowedOrigins` | Allowed frontend origins |
| `ConnectionStrings:Redis` / `Redis:ConnectionString` | Optional Redis cache |
| `Blob:ConnectionString` / `Blob:ContainerName` | Azure Blob Storage for files |
| `EmailSettings:*` | SMTP for OTP email |
| `Whisper:Model`, `Whisper:ModelsDir` | Whisper transcription model |
| `YouTube:ProxyUrls`, `YouTube:CookiesList` | Proxy/cookie pool for yt-dlp |
| `IpRateLimiting:*` | IP rate-limit rules |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | Azure Application Insights |

JWT bearer auth validates issuer, audience, signing key, and lifetime. Expired tokens are signalled to the client via a `Token-Expired: true` response header:

```csharp
// Program.cs — JWT expiry header
OnAuthenticationFailed = context =>
{
    if (context.Exception is SecurityTokenExpiredException)
        context.Response.Headers.Append("Token-Expired", "true");
    return Task.CompletedTask;
}
```

CORS in development allows any `localhost` or `127.0.0.1` origin with credentials. In production it restricts to `Cors:AllowedOrigins`.

## Health And Ops

The API exposes `/health`, Swagger at `/swagger`, and Application Insights telemetry when configured.
