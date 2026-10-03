using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Infrastructure.Data.Configurations;

public class GlossaryTermConfiguration : IEntityTypeConfiguration<GlossaryTerm>
{
    public void Configure(EntityTypeBuilder<GlossaryTerm> builder)
    {
        builder.HasKey(t => t.GlossaryTermId);
        builder.Property(t => t.Term).IsRequired().HasMaxLength(500);
        builder.Property(t => t.Definition).IsRequired().HasColumnType("text");
        builder.Property(t => t.CreatedAt).IsRequired();

        builder.HasOne(t => t.Document)
            .WithMany()
            .HasForeignKey(t => t.DocumentId)
            .OnDelete(DeleteBehavior.Cascade)
            .IsRequired(false);

        builder.HasOne(t => t.Video)
            .WithMany()
            .HasForeignKey(t => t.VideoId)
            .OnDelete(DeleteBehavior.Cascade)
            .IsRequired(false);

        // Serves per-user glossary listing and search: WHERE UserId = @u ORDER BY Term.
        // GlossaryTerm previously had no UserId-prefixed index at all.
        builder.HasIndex(t => new { t.UserId, t.Term });

        // Trigram indexes for the ILIKE '%term%' searches in GlossaryTermRepository. The (UserId, Term)
        // B-tree above can't serve a leading wildcard, and Definition has no index at all without this.
        builder.HasIndex(t => t.Term).HasMethod("gin").HasOperators("gin_trgm_ops");
        builder.HasIndex(t => t.Definition).HasMethod("gin").HasOperators("gin_trgm_ops");

        builder.ToTable("GlossaryTerms");
    }
}
