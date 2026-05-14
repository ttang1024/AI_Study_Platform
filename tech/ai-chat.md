# AI Chat

## Chat Modes

| Mode | Storage | Main routes |
| --- | --- | --- |
| Document chat | `ChatMessage` with `DocumentId` | `/api/courses/{courseId}/documents/{documentId}/chat...` |
| YouTube chat | `ChatMessage` with `YouTubeVideoId` | `/api/youtube/videos/{id}/chat...` |
| General chat | `ChatConversation` + `ChatMessage` | `/api/ai/chat/conversations...` |

All three support streamed replies.

## General Chat Routes

`AiController` is mounted at `/api/ai`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/chat/sessions` | Combined document/video chat session summaries |
| `POST` | `/chat` | Stateless non-streaming general chat |
| `POST` | `/chat/stream` | Stateless SSE general chat |
| `GET` | `/test-provider` | Test configured provider |
| `POST` | `/chat/conversations` | Create persistent conversation |
| `GET` | `/chat/conversations/{id}/messages` | Load conversation messages |
| `POST` | `/chat/conversations/{id}/stream` | SSE reply and persist messages |
| `DELETE` | `/chat/conversations/{id}` | Delete conversation |

## SSE Streaming

All streaming chat endpoints follow the same pattern: set SSE headers, iterate the `IAsyncEnumerable<string>` from `AiService`, write each chunk, then signal `[DONE]`.

```csharp
// SseExtensions.cs — SSE helpers used by all stream endpoints
public static void SetSseHeaders(this HttpResponse response)
{
    response.ContentType          = "text/event-stream";
    response.Headers["Cache-Control"]    = "no-cache";
    response.Headers["X-Accel-Buffering"] = "no";
}

public static async Task WriteSseDataAsync(
    this HttpResponse response, string data, CancellationToken ct)
{
    await response.WriteAsync($"data: {JsonSerializer.Serialize(data)}\n\n", ct);
    await response.Body.FlushAsync(ct);
}

public static async Task WriteSseDoneAsync(this HttpResponse response, CancellationToken ct)
{
    await response.WriteAsync("data: [DONE]\n\n", ct);
    await response.Body.FlushAsync(ct);
}
```

Controller streaming action pattern:

```csharp
response.SetSseHeaders();
await foreach (var chunk in _aiService.StreamChatWithYouTubeAsync(transcript, history, message, ct))
    await response.WriteSseDataAsync(chunk, ct);
await response.WriteSseDoneAsync(ct);
```

## Frontend

`web/src/pages/ChatListPage.tsx` renders the unified chat page. Embedded source chat uses `web/src/components/ai/ChatPanel.tsx`.

Services are in `web/src/services/aiService.ts`, `documentService.ts`, and `youtubeService.ts`.
