using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using StudyPlatform.Application.Flashcards;
using StudyPlatform.Application.Services;
using StudyPlatform.Application.Settings;
using Xunit;

namespace StudyPlatform.Tests.Flashcards;

public class FlashcardDeduplicatorTests
{
    private const double Threshold = 0.10;

    private readonly Mock<IEmbeddingService> _embeddings = new();
    private readonly Mock<IEmbeddingIndex> _index = new();
    private readonly FlashcardDeduplicator _deduplicator;
    private readonly Guid _userId = Guid.NewGuid();

    public FlashcardDeduplicatorTests()
    {
        _embeddings.Setup(e => e.IsEnabled).Returns(true);
        _embeddings.Setup(e => e.Model).Returns("test-model");

        // Nothing in the library unless a test says otherwise.
        _index
            .Setup(i => i.FindNearestAsync(
                It.IsAny<Guid>(), It.IsAny<float[]>(), It.IsAny<string>(), It.IsAny<int>(), default))
            .ReturnsAsync([]);

        _deduplicator = new FlashcardDeduplicator(
            _embeddings.Object,
            _index.Object,
            Options.Create(new EmbeddingOptions { ApiKey = "k", DuplicateDistance = Threshold }),
            NullLogger<FlashcardDeduplicator>.Instance);
    }

    private static FlashcardCandidate Card(int key, string front, string back = "back")
        => new(key, front, back);

    /// <summary>Stubs the embedder to return the given vectors, in order.</summary>
    private void EmbedsAs(params float[][] vectors)
        => _embeddings
            .Setup(e => e.EmbedAsync(It.IsAny<IReadOnlyList<string>>(), default))
            .ReturnsAsync(vectors);

    private void LibraryContains(float[] vector, double distance)
        => _index
            .Setup(i => i.FindNearestAsync(_userId, vector, EmbeddingSourceTypes.Flashcard, 1, default))
            .ReturnsAsync([new EmbeddingHit("flashcard", Guid.NewGuid(), "t", "x", 0, distance)]);

    [Fact]
    public async Task Filter_EmbeddingsDisabled_KeepsEverything()
    {
        _embeddings.Setup(e => e.IsEnabled).Returns(false);
        var candidates = new[] { Card(0, "A"), Card(1, "B") };

        var result = await _deduplicator.FilterAsync(_userId, candidates, default);

        Assert.Equal(2, result.Kept.Count);
        Assert.Equal(0, result.DuplicateCount);
        _embeddings.Verify(e => e.EmbedAsync(It.IsAny<IReadOnlyList<string>>(), default), Times.Never);
    }

    [Fact]
    public async Task Filter_EmbeddingProviderThrows_KeepsEverythingRatherThanLosingTheCards()
    {
        _embeddings
            .Setup(e => e.EmbedAsync(It.IsAny<IReadOnlyList<string>>(), default))
            .ThrowsAsync(new HttpRequestException("provider down"));

        var result = await _deduplicator.FilterAsync(_userId, [Card(0, "A"), Card(1, "B")], default);

        Assert.Equal(2, result.Kept.Count);
        Assert.Equal(0, result.DuplicateCount);
    }

    [Fact]
    public async Task Filter_ProviderReturnsWrongNumberOfVectors_KeepsEverything()
    {
        EmbedsAs([1f, 0f]); // one vector for two candidates

        var result = await _deduplicator.FilterAsync(_userId, [Card(0, "A"), Card(1, "B")], default);

        Assert.Equal(2, result.Kept.Count);
    }

    [Fact]
    public async Task Filter_CandidateMatchesAnExistingCard_IsDroppedAsDuplicate()
    {
        var vector = new[] { 1f, 0f };
        EmbedsAs(vector);
        LibraryContains(vector, distance: 0.02); // well inside the threshold

        var result = await _deduplicator.FilterAsync(_userId, [Card(0, "Restated fact")], default);

        Assert.Empty(result.Kept);
        Assert.Single(result.DuplicateOfExisting);
        Assert.Empty(result.DuplicateWithinBatch);
    }

    [Fact]
    public async Task Filter_NearestExistingCardIsBeyondTheThreshold_IsKept()
    {
        var vector = new[] { 1f, 0f };
        EmbedsAs(vector);
        LibraryContains(vector, distance: 0.40); // a different fact about the same topic

        var result = await _deduplicator.FilterAsync(_userId, [Card(0, "A new fact")], default);

        Assert.Single(result.Kept);
        Assert.Equal(0, result.DuplicateCount);
    }

    [Fact]
    public async Task Filter_DistanceExactlyAtTheThreshold_CountsAsDuplicate()
    {
        var vector = new[] { 1f, 0f };
        EmbedsAs(vector);
        LibraryContains(vector, distance: Threshold);

        var result = await _deduplicator.FilterAsync(_userId, [Card(0, "Edge")], default);

        Assert.Single(result.DuplicateOfExisting);
    }

    // One generation can emit the same fact twice. Those candidates are not in the index yet, so the
    // library probe cannot catch them — they have to be compared against each other in memory.
    [Fact]
    public async Task Filter_TwoNearIdenticalCandidatesInOneBatch_KeepsOnlyTheFirst()
    {
        EmbedsAs([1f, 0f], [1f, 0.001f]); // ~0 cosine distance apart

        var result = await _deduplicator.FilterAsync(_userId, [Card(0, "First"), Card(1, "Restated")], default);

        Assert.Single(result.Kept);
        Assert.Equal(0, result.Kept[0].Key); // the first one survives
        Assert.Single(result.DuplicateWithinBatch);
        Assert.Equal(1, result.DuplicateWithinBatch[0].Key);
    }

    [Fact]
    public async Task Filter_OrthogonalCandidatesInOneBatch_AreBothKept()
    {
        EmbedsAs([1f, 0f], [0f, 1f]); // cosine distance 1.0

        var result = await _deduplicator.FilterAsync(_userId, [Card(0, "A"), Card(1, "B")], default);

        Assert.Equal(2, result.Kept.Count);
        Assert.Equal(0, result.DuplicateCount);
    }

    [Fact]
    public async Task Filter_NoCandidates_ShortCircuits()
    {
        var result = await _deduplicator.FilterAsync(_userId, [], default);

        Assert.Empty(result.Kept);
        _embeddings.Verify(e => e.EmbedAsync(It.IsAny<IReadOnlyList<string>>(), default), Times.Never);
    }

    // Two cards can share a front and differ entirely in their answer ("What year?" / 1789 vs 1804).
    // Embedding the front alone would collapse them into one; the text sent to the embedder must
    // include the back.
    [Fact]
    public async Task Filter_EmbedsBothSidesOfTheCard()
    {
        IReadOnlyList<string>? embedded = null;
        _embeddings
            .Setup(e => e.EmbedAsync(It.IsAny<IReadOnlyList<string>>(), default))
            .Callback<IReadOnlyList<string>, CancellationToken>((texts, _) => embedded = texts)
            .ReturnsAsync([[1f, 0f]]);

        await _deduplicator.FilterAsync(_userId, [Card(0, "What year?", "1789")], default);

        Assert.NotNull(embedded);
        Assert.Contains("What year?", embedded![0]);
        Assert.Contains("1789", embedded[0]);
    }

    [Fact]
    public async Task Index_EmbeddingsDisabled_DoesNothing()
    {
        _embeddings.Setup(e => e.IsEnabled).Returns(false);

        await _deduplicator.IndexAsync(_userId, [(Guid.NewGuid(), "f", "b")], default);

        _index.Verify(
            i => i.IndexSourceAsync(
                It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<Guid>(),
                It.IsAny<string>(), It.IsAny<string>(), default),
            Times.Never);
    }

    [Fact]
    public async Task Index_StoresEachCardUnderTheFlashcardSourceType()
    {
        var id = Guid.NewGuid();

        await _deduplicator.IndexAsync(_userId, [(id, "Front", "Back")], default);

        _index.Verify(
            i => i.IndexSourceAsync(
                _userId, EmbeddingSourceTypes.Flashcard, id, "Front",
                It.Is<string>(t => t.Contains("Front") && t.Contains("Back")), default),
            Times.Once);
    }

    [Fact]
    public async Task Index_IndexingFailure_DoesNotThrow_TheCardIsAlreadySaved()
    {
        _index
            .Setup(i => i.IndexSourceAsync(
                It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<Guid>(),
                It.IsAny<string>(), It.IsAny<string>(), default))
            .ThrowsAsync(new HttpRequestException("provider down"));

        var ex = await Record.ExceptionAsync(
            () => _deduplicator.IndexAsync(_userId, [(Guid.NewGuid(), "f", "b")], default));

        Assert.Null(ex);
    }
}
