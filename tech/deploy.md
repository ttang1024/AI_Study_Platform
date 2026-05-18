# Deployment

## Scripts

| Script | Purpose |
| --- | --- |
| `deploy.sh` | Full AWS deployment |
| `deploy-backend.sh` | AWS API/backend redeploy |
| `deploy-web.sh` | AWS web/admin frontend redeploy |
| `deploy-app.sh` | App deployment helper |
| `generate-proxy-env.sh` | YouTube proxy env helper |
| `generate-cookies-env.sh` | YouTube cookie env helper |
| `load-env.sh` | Load local env file |

## Backend Runtime Requirements

- PostgreSQL connection string
- JWT settings
- CORS origins
- ElastiCache Redis for the AWS cache tier
- S3 for AWS file storage, or MinIO for local S3-compatible storage
- SMTP settings for OTP email, or AWS SES settings when `EMAIL_PROVIDER=Ses`
- AI provider settings supplied by users through request headers
- YouTube proxy/cookie settings when cloud IPs are blocked by YouTube

## Runtime Configuration (Program.cs)

Key server-side settings required at runtime:

| Config key | Purpose |
| --- | --- |
| `ConnectionStrings:DefaultConnection` | PostgreSQL (required) |
| `JwtSettings:SecretKey`, `Issuer`, `Audience` | JWT signing and validation |
| `Cors:AllowedOrigins` | Allowed frontend origins |
| `Redis:Enabled` | Enable Redis cache (`true` in AWS deployment) |
| `ConnectionStrings:Redis` / `Redis:ConnectionString` | Redis endpoint |
| `S3:BucketName` | S3/MinIO bucket for uploaded documents |
| `S3:ServiceUrl` / `S3:Endpoint` | Optional S3-compatible endpoint, for example local MinIO |
| `S3:PublicServiceUrl` | Optional browser-reachable endpoint used when generating pre-signed URLs |
| `S3:ForcePathStyle` | Use path-style bucket URLs; required for MinIO |
| `S3:AccessKey`, `S3:SecretKey` | Optional static credentials for S3-compatible storage |
| `EmailSettings:Provider`, `FromEmail` | Email provider selection and sender address |
| `EmailSettings:SmtpHost`, `SmtpPort`, `SmtpUser`, `SmtpPassword` | SMTP email |
| `EmailSettings:SesRegion` | AWS SES region when `EmailSettings:Provider` is `Ses` |
| `Whisper:Model`, `Whisper:ModelsDir` | Whisper transcription model |
| `YouTube:ProxyUrls`, `YouTube:CookiesList` | Proxy/cookie pool for yt-dlp |
| `IpRateLimiting:*` | IP rate-limit rules |

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

The API exposes `/health` and Swagger at `/swagger`.
