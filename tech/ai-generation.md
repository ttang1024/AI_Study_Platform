# AI Generation

## Service

`server/StudyPlatform.Infrastructure/Services/AiService.cs` implements `IAiService` and centralizes text generation, streaming, JSON cleanup, provider-specific request building, response parsing, and generated-result caching.

## Provider Selection

The service reads AI settings from request headers:

| Header | Meaning |
| --- | --- |
| `X-AI-Provider` | provider key such as `gemini`, `openai`, `claude`, `deepseek`, `grok`, `qwen`, `wenxin`, `kimi`, or `doubao` |
| `X-AI-Model` | model name |
| `X-AI-Key` | provider API key |

Missing provider/model/key settings throw explicit configuration errors so the user can fix settings in the UI.

```csharp
// AiService.cs — provider URL routing
private string GetNonStreamUrl() => Provider switch
{
    "openai"   => "https://api.openai.com/v1/chat/completions",
    "deepseek" => "https://api.deepseek.com/v1/chat/completions",
    "kimi"     => "https://api.moonshot.cn/v1/chat/completions",
    "doubao"   => "https://ark.volcengine.com/api/v3/chat/completions",
    "claude"   => "https://api.anthropic.com/v1/messages",
    "grok"     => "https://api.x.ai/v1/chat/completions",
    "qwen"     => "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    "wenxin"   => "https://qianfan.baidubce.com/v2/chat/completions",
    _          => $"{AiBaseUrl}?key={ApiKey}",  // gemini
};
```

## Supported Generation Features

The current interface is used for:

- document and YouTube summaries
- mind maps
- flashcards, including basic, cloze, and chart cards
- quizzes with difficulty
- glossary extraction
- document, YouTube, and general chat
- worked problem generation and attempt evaluation
- concept link generation for the knowledge graph

## Core: Non-Streaming Text

All provider-agnostic generation goes through `SendTextAsync`. It builds the provider-specific request, sends it, and optionally strips markdown fences from JSON responses.

```csharp
// AiService.cs — non-streaming core
private async Task<string> SendTextAsync(
    string? systemPrompt,
    IEnumerable<(string role, string content)> messages,
    double temperature,
    int maxTokens,
    bool cleanJson,
    CancellationToken cancellationToken)
{
    using var request = BuildRequest(systemPrompt, messages, temperature, maxTokens, stream: false, GetNonStreamUrl());
    using var response = await _httpClient.SendAsync(request, cancellationToken);
    if (!response.IsSuccessStatusCode)
    {
        var err = await response.Content.ReadAsStringAsync(cancellationToken);
        throw new InvalidOperationException($"{Provider} API returned {response.StatusCode}: {err}");
    }
    var json = await response.Content.ReadAsStringAsync(cancellationToken);
    var text = ExtractTextFromResponse(json);
    return cleanJson ? CleanJsonResponse(text) : text.Trim();
}
```

## Core: SSE Streaming

`StreamTextAsync` reads the response body line-by-line as an async stream and yields each text delta as a `string`.

```csharp
// AiService.cs — streaming core
private async IAsyncEnumerable<string> StreamTextAsync(
    string? systemPrompt,
    IEnumerable<(string role, string content)> messages,
    double temperature,
    int maxTokens,
    [EnumeratorCancellation] CancellationToken cancellationToken)
{
    using var request = BuildRequest(systemPrompt, messages, temperature, maxTokens, stream: true, GetStreamUrl());
    using var response = await _httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);

    using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
    using var reader = new StreamReader(stream);

    while (true)
    {
        var line = await reader.ReadLineAsync(cancellationToken);
        if (line == null) break;
        if (!line.StartsWith("data: ")) continue;

        var data = line[6..].TrimEnd();
        if (data == "[DONE]") break;

        string? text = null;
        try { text = ExtractChunkText(data); } catch { }
        if (!string.IsNullOrEmpty(text))
            yield return text;
    }
}
```

## Request Builder

`BuildRequest` serialises the body in the correct shape for each provider family.

```csharp
// AiService.cs — provider-specific body shape
if (Provider == "gemini")
{
    // systemInstruction + contents + generationConfig
}
else if (Provider == "claude")
{
    // { model, max_tokens, system?, messages, temperature, stream }
    // Auth: x-api-key header + anthropic-version
}
else
{
    // OpenAI-compatible: { model, messages, temperature, max_tokens, stream }
    // Auth: Authorization: Bearer <key>
}
```

## Response Parsing

`ExtractTextFromResponse` handles all three response shapes:

```csharp
// AiService.cs — response text extraction
private string ExtractTextFromResponse(string json)
{
    using var doc = JsonDocument.Parse(json);
    if (Provider == "gemini")
        return doc.RootElement
            .GetProperty("candidates")[0]
            .GetProperty("content").GetProperty("parts")[0]
            .GetProperty("text").GetString()!;

    if (Provider == "claude")
        return doc.RootElement
            .GetProperty("content")[0]
            .GetProperty("text").GetString()!;

    // OpenAI-compatible
    return doc.RootElement
        .GetProperty("choices")[0]
        .GetProperty("message").GetProperty("content").GetString()!;
}
```

## JSON Cleanup

`CleanJsonResponse` strips markdown fences and trims surrounding prose before returning raw JSON to callers. It finds the first `{` or `[`, then walks the string character-by-character to find the matching close bracket.

```csharp
// AiService.cs — JSON fence stripping
private static string CleanJsonResponse(string text)
{
    text = text.Trim();
    if (text.StartsWith("```json")) text = text[7..];
    else if (text.StartsWith("```"))  text = text[3..];
    if (text.EndsWith("```"))         text = text[..^3];

    var objStart = text.IndexOf('{');
    var arrStart = text.IndexOf('[');
    var jsonStart = (objStart, arrStart) switch
    {
        ( >= 0, >= 0) => Math.Min(objStart, arrStart),
        ( >= 0, _)    => objStart,
        (_, >= 0)     => arrStart,
        _             => -1
    };
    if (jsonStart >= 0) text = text[jsonStart..];

    var jsonEnd = FindJsonEnd(text);   // depth-tracking bracket scanner
    if (jsonEnd > 0) text = text[..jsonEnd];
    return text.Trim();
}
```

## Streaming

Long-running outputs use SSE through controller endpoints. The API streams chunks from `AiService` and persists the completed generated result when appropriate.

## Caching

Generated AI output is cached through `IAppCache` using provider, model, category, and input hash. The TTL comes from `Cache:AiGenerationSeconds`.

```csharp
// AiService.cs — cache wrapper used by every generation method
private Task<string> CacheGeneratedResultAsync(
    string category,
    string inputHash,
    Func<CancellationToken, Task<string>> factory,
    CancellationToken cancellationToken)
{
    var cacheKey = $"ai:{Provider}:{Model}:{category}:{inputHash}";
    return _cache.GetOrCreateAsync(
        cacheKey,
        factory,
        TimeSpan.FromSeconds(_cacheOptions.GeneratedResultSeconds),
        cancellationToken);
}
```

## Frontend Settings

`web/src/pages/SettingsPage.tsx` and `web/src/services/aiSettingsService.ts` manage local provider/model/key settings and pass them through API calls.
