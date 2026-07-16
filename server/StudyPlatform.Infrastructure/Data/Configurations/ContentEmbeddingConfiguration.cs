using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Infrastructure.Data.Configurations;

public class ContentEmbeddingConfiguration : IEntityTypeConfiguration<ContentEmbedding>
{
    /// <summary>
    /// pgvector needs a fixed column width, so this is baked into the schema rather than configured.
    /// It is the native width of OpenAI's text-embedding-3-* models; shorter vectors from other
    /// providers are zero-padded to fit (see EmbeddingService).
    /// </summary>
    public const int Dimensions = 1536;

    public void Configure(EntityTypeBuilder<ContentEmbedding> builder)
    {
        builder.HasKey(e => e.ContentEmbeddingId);
        builder.Property(e => e.SourceType).IsRequired().HasMaxLength(20);
        builder.Property(e => e.Title).IsRequired().HasMaxLength(500);
        builder.Property(e => e.Text).IsRequired();
        builder.Property(e => e.SourceHash).IsRequired().HasMaxLength(64);
        builder.Property(e => e.Model).IsRequired().HasMaxLength(120);
        builder.Property(e => e.Embedding).HasColumnType($"vector({Dimensions})");

        // Every retrieval is scoped to one user, and the backfill worker looks sources up by identity.
        builder.HasIndex(e => new { e.UserId, e.SourceType, e.SourceId });

        // HNSW over cosine distance: the ANN index behind the <=> ordering in EmbeddingIndex.SearchAsync.
        // Without it, retrieval degrades to a full scan over every chunk the user owns.
        builder.HasIndex(e => e.Embedding)
            .HasMethod("hnsw")
            .HasOperators("vector_cosine_ops");

        builder.HasOne(e => e.User)
            .WithMany()
            .HasForeignKey(e => e.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
