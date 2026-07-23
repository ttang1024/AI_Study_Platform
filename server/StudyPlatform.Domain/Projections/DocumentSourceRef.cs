namespace StudyPlatform.Domain.Projections;

/// <summary>
/// The two columns the anonymous share endpoints need to serve a shared document: what it is, and where
/// its bytes live. They stream the blob and never touch the document's own text, so nothing else is read.
/// </summary>
public record DocumentSourceRef(string ContentType, string BlobUrl);
