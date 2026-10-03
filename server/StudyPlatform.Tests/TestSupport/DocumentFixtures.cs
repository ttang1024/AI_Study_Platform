using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Tests.TestSupport;

/// <summary>A stored document, for the handler suites that only need one to exist and be owned.</summary>
public static class DocumentFixtures
{
    /// <param name="fileName">Override only where the test is about the name, e.g. a rename.</param>
    public static Document Make(Guid userId, string fileName = "test.pdf") => new()
    {
        DocumentId = Guid.NewGuid(),
        UserId = userId,
        CourseId = Guid.NewGuid(),
        FileName = fileName,
        BlobUrl = "blob://test",
        ContentType = "application/pdf",
        CreatedAt = DateTime.UtcNow,
        UpdatedAt = DateTime.UtcNow,
    };
}
