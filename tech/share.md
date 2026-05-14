# Share

## Routes

`ShareController` is mounted at `/api/share`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/share` | Create a share token for supported content |
| `GET` | `/api/share/{token}` | Resolve shared content metadata |
| `GET` | `/api/share/{token}/audio` | Stream shared audio |
| `GET` | `/api/share/{token}/article` | Load shared article content |
| `GET` | `/api/share/{token}/file` | Load shared file |

`ShareToken` stores source information, expiry, and serialized generated data such as glossary content where applicable.

## Implementation

### Token Generation

Share tokens are 9 random bytes encoded as URL-safe base64 (12 characters, no padding):

```csharp
// ShareController.cs — GenerateToken
private static string GenerateToken()
{
    var bytes = new byte[9];
    System.Security.Cryptography.RandomNumberGenerator.Fill(bytes);
    return Convert.ToBase64String(bytes)
        .Replace("+", "-").Replace("/", "_").TrimEnd('=');
}
```

### Create Share

`POST /api/share` stores all pre-serialised content (summary, mind map, quizzes JSON, flashcards JSON, glossary JSON) directly in the `ShareToken` row. Optional `ExpiresInDays` sets an absolute expiry.

```csharp
// ShareController.cs — CreateShare
var share = new ShareToken
{
    Id           = Guid.NewGuid(),
    Token        = GenerateToken(),
    OwnerId      = userId,
    Title        = request.Title,
    Summary      = request.Summary,
    QuizzesJson  = request.QuizzesJson,
    FlashcardsJson = request.FlashcardsJson,
    GlossaryJson = request.GlossaryJson,
    ExpiresAt    = request.ExpiresInDays.HasValue
                   ? DateTime.UtcNow.AddDays(request.ExpiresInDays.Value)
                   : null,
    SourceType   = request.SourceType,
    SourceUrl    = request.SourceUrl,
};
await _unitOfWork.ShareTokens.AddAsync(share, cancellationToken);
await _unitOfWork.SaveChangesAsync(cancellationToken);
```

### Resolve Share

`GET /api/share/{token}` is `[AllowAnonymous]`. It checks expiry and returns HTTP 410 Gone for expired links. Stored JSON fields are deserialised to `object` so the response stays provider-neutral:

```csharp
// ShareController.cs — GetShare
if (share.ExpiresAt.HasValue && share.ExpiresAt.Value < DateTime.UtcNow)
    return StatusCode(410, BaseResponse<object>.Fail("This share link has expired"));

if (share.QuizzesJson != null)
    try { quizzes = JsonSerializer.Deserialize<object>(share.QuizzesJson); } catch { }
```

### Audio/File Streaming

For audio and podcast shares, the controller generates a short-lived SAS URL and redirects rather than proxying bytes. For documents it streams directly through the server to avoid CORS issues:

```csharp
// ShareController.cs — StreamAudio (SAS redirect) vs StreamFile (server proxy)

// Audio: generate SAS and redirect
var sasUrl = await _blobStorage.GetSasUrlAsync(doc.BlobUrl, expiryMinutes: 60, ct);
return Redirect(sasUrl);

// Document file: proxy through server
var stream = await _blobStorage.DownloadAsync(doc.BlobUrl, ct);
return File(stream, doc.ContentType ?? "application/octet-stream");
```

## Frontend

Shared content is rendered by `web/src/pages/SharedContentPage.tsx` and Next metadata routes under `web/src/app/share/[token]`. Creation uses `ShareModal`, `GlossaryShareModal`, `shareService.ts`, and `shareContentService.ts`.
