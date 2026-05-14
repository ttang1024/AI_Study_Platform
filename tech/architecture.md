# Architecture

## Current Shape

Study Platform is split into three deployable apps:

| App | Path | Runtime | Purpose |
| --- | --- | --- | --- |
| API | `server/StudyPlatform.API` | ASP.NET Core on .NET 10 | HTTP API, SignalR hub, auth, Swagger, health checks |
| Web | `web` | React 19 + Vite, with optional Next metadata routes | Main learner experience |
| Admin | `admin` | React 19 + Vite | Admin feedback and user management |

The backend follows a Clean Architecture layout:

| Layer | Path | Responsibility |
| --- | --- | --- |
| API | `StudyPlatform.API` | Controllers, middleware, SignalR, auth/CORS/rate limit setup |
| Application | `StudyPlatform.Application` | MediatR commands/queries, DTOs, validation, service interfaces |
| Domain | `StudyPlatform.Domain` | Entities and repository interfaces |
| Infrastructure | `StudyPlatform.Infrastructure` | EF Core, repositories, external services, AI providers, storage, email |

## Backend Runtime

`Program.cs` configures:

- Controllers and Swagger at `/swagger`
- JWT bearer auth, including SignalR query-token support for `/hubs/*`
- CORS from `Cors:AllowedOrigins`; development allows localhost and `127.0.0.1`
- Redis-backed distributed cache when `Redis:ConnectionString` or `ConnectionStrings:Redis` is valid; memory cache fallback otherwise
- process-local IP rate limiting through `AspNetCoreRateLimit`
- SignalR at `/hubs/group-chat`
- Application Insights telemetry
- EF Core migrations applied on startup
- `/health` and `/` health-style endpoints

## Frontend Routing

`web/src/App.tsx` is the main client router. Public routes are `/`, `/login`, `/register`, `/verify-email`, `/auth/callback`, and `/share/:token`. Protected routes include dashboard, library, summarizer, flashcards, notes, quizzes, glossary, knowledge graph, reinforcement center, feedback, search, groups, chat, document/video/article/audio details, and course study.

## Cross-Cutting Patterns

- Commands and queries use MediatR.
- API responses use `Result` and controller helpers to map failures.
- Persistence uses EF Core repositories behind `IUnitOfWork`.
- Long AI operations stream through SSE.
- Study group chat uses SignalR.
- AI settings are request-scoped through `X-AI-Provider`, `X-AI-Model`, and `X-AI-Key` headers.

### Result pattern

Every handler returns `Result<T>` or `Result`. Controllers translate it to the HTTP response without any domain logic leaking into the controller layer:

```csharp
// Pattern used across all controllers
var result = await _mediator.Send(command, cancellationToken);
if (!result.IsSuccess)
    return BadRequest(BaseResponse<T>.Fail(result.Message, result.ErrorCode));
return Ok(BaseResponse<T>.Ok(result.Data!));
```

`Result.Failure` carries a human-readable `Message` and a machine-readable `ErrorCode` so the frontend can branch on specific error types (e.g. `EMAIL_NOT_VERIFIED`, `DOCUMENT_LIMIT_REACHED`).

### Middleware pipeline

`Program.cs` composes the ASP.NET Core middleware pipeline in this order:

```csharp
app.UseMiddleware<RequestLoggingMiddleware>();
app.UseMiddleware<GlobalExceptionHandlerMiddleware>();
app.UseSwagger();  app.UseSwaggerUI(...);
app.UseCors("AllowFrontend");
app.UseIpRateLimiting();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHub<GroupChatHub>("/hubs/group-chat");
app.MapHealthChecks("/health");
```

`GlobalExceptionHandlerMiddleware` catches unhandled exceptions and returns a consistent `BaseResponse` JSON envelope so clients always receive parseable error responses.

### JWT SignalR support

SignalR connections cannot send `Authorization` headers, so `Program.cs` maps the `access_token` query parameter to the bearer token for hub routes:

```csharp
// Program.cs — JWT bearer auth with SignalR query-token support
options.Events = new JwtBearerEvents
{
    OnMessageReceived = context =>
    {
        var accessToken = context.Request.Query["access_token"];
        var path = context.HttpContext.Request.Path;
        if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
            context.Token = accessToken;
        return Task.CompletedTask;
    }
};
```
