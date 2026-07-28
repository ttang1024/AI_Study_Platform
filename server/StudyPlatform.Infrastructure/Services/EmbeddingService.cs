using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.Settings;
using StudyPlatform.Infrastructure.Data.Configurations;

namespace StudyPlatform.Infrastructure.Services;

/// <summary>
/// Embeddings over OpenAI-compatible /v1/embeddings endpoints (OpenAI, Qwen, local servers) and
/// Gemini. Anthropic and DeepSeek publish no embeddings API, which is why this is configured
/// separately from the chat provider rather than reusing the user's X-AI-* headers.
/// </summary>
public class EmbeddingService : IEmbeddingService
{
    private readonly HttpClient _httpClient;
    private readonly EmbeddingOptions _options;
    private readonly ILogger<EmbeddingService> _logger;

    public EmbeddingService(HttpClient httpClient, IOptions<EmbeddingOptions> options, ILogger<EmbeddingService> logger)
    {
        _httpClient = httpClient;
        _options = options.Value;
        _logger = logger;
    }

    public bool IsEnabled => _options.IsConfigured;

    public string Model => _options.Model;

    private bool IsGemini => _options.Provider.Equals("gemini", StringComparison.OrdinalIgnoreCase);

    public async Task<float[]> EmbedOneAsync(string text, CancellationToken cancellationToken = default)
    {
        var vectors = await EmbedAsync([text], cancellationToken);
        return vectors.Count > 0 ? vectors[0] : [];
    }

    public async Task<IReadOnlyList<float[]>> EmbedAsync(IReadOnlyList<string> texts, CancellationToken cancellationToken = default)
    {
        if (!IsEnabled)
            throw new InvalidOperationException("Embeddings are not configured. Set Embeddings:ApiKey to enable semantic search.");

        if (texts.Count == 0)
            return [];

        var results = new List<float[]>(texts.Count);

        // Providers cap how many inputs one request may carry, so long documents go up in batches.
        foreach (var batch in texts.Chunk(Math.Max(1, _options.BatchSize)))
        {
            var vectors = IsGemini
                ? await EmbedGeminiBatchAsync(batch, cancellationToken)
                : await EmbedOpenAiBatchAsync(batch, cancellationToken);
            results.AddRange(vectors);
        }

        return results;
    }

    private async Task<IReadOnlyList<float[]>> EmbedOpenAiBatchAsync(string[] batch, CancellationToken cancellationToken)
    {
        var baseUrl = (_options.BaseUrl ?? "https://api.openai.com/v1").TrimEnd('/');

        using var request = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl}/embeddings")
        {
            Content = JsonBody(new { model = _options.Model, input = batch }),
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.ApiKey);

        using var response = await SendAsync(request, cancellationToken);
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken));

        // The response may come back out of order, so trust "index" rather than the array position.
        var vectors = new float[batch.Length][];
        foreach (var item in doc.RootElement.GetProperty("data").EnumerateArray())
        {
            var index = item.GetProperty("index").GetInt32();
            if (index < 0 || index >= vectors.Length) continue;
            vectors[index] = ReadVector(item.GetProperty("embedding"));
        }

        return vectors.Select(v => Normalize(v ?? [])).ToList();
    }

    private async Task<IReadOnlyList<float[]>> EmbedGeminiBatchAsync(string[] batch, CancellationToken cancellationToken)
    {
        var model = _options.Model.StartsWith("models/") ? _options.Model : $"models/{_options.Model}";
        var baseUrl = (_options.BaseUrl ?? "https://generativelanguage.googleapis.com/v1beta").TrimEnd('/');

        // Gemini's embedding models default to an output width wider than the vector column
        // (gemini-embedding-001 emits 3072), and Normalize rejects anything over-long rather than
        // truncate it. Asking for the column width up front is what makes those models usable at all.
        var requests = batch.Select(text => new
        {
            model,
            content = new { parts = new[] { new { text } } },
            outputDimensionality = ContentEmbeddingConfiguration.Dimensions,
        });

        using var request = new HttpRequestMessage(
            HttpMethod.Post,
            $"{baseUrl}/{model}:batchEmbedContents?key={_options.ApiKey}")
        {
            Content = JsonBody(new { requests }),
        };

        using var response = await SendAsync(request, cancellationToken);
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken));

        return doc.RootElement.GetProperty("embeddings").EnumerateArray()
            .Select(e => Normalize(ReadVector(e.GetProperty("values"))))
            .ToList();
    }

    private async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var response = await _httpClient.SendAsync(request, cancellationToken);
        if (response.IsSuccessStatusCode)
            return response;

        var error = await response.Content.ReadAsStringAsync(cancellationToken);
        response.Dispose();
        _logger.LogError("Embeddings API error: {Status} - {Error}", response.StatusCode, error);
        throw new InvalidOperationException($"Embeddings API returned {response.StatusCode}: {error}");
    }

    private static StringContent JsonBody(object body)
        => new(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");

    private static float[] ReadVector(JsonElement array)
        => array.EnumerateArray().Select(v => v.GetSingle()).ToArray();

    /// <summary>
    /// The vector column is a fixed 1536 wide, but providers ship different widths (Gemini 768,
    /// Qwen 1024). Zero-padding preserves cosine similarity exactly — the extra dimensions contribute
    /// nothing to either the dot product or the magnitudes — so short vectors are simply padded to fit.
    /// Over-long vectors would silently lose information, so those are rejected outright.
    /// </summary>
    private static float[] Normalize(float[] vector)
    {
        const int width = ContentEmbeddingConfiguration.Dimensions;

        if (vector.Length == width)
            return vector;

        // An all-zero vector is equidistant from everything and would poison retrieval, so a chunk the
        // provider skipped has to fail loudly rather than be stored.
        if (vector.Length == 0)
            throw new InvalidOperationException("Embeddings API returned no vector for one of the inputs.");

        if (vector.Length > width)
            throw new InvalidOperationException(
                $"Embedding model returned {vector.Length} dimensions but the vector column holds {width}. " +
                $"Choose a model with {width} dimensions or fewer.");

        var padded = new float[width];
        vector.CopyTo(padded, 0);
        return padded;
    }
}
