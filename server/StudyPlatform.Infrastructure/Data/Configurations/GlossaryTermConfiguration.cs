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

        builder.HasOne(t => t.YouTubeVideo)
            .WithMany()
            .HasForeignKey(t => t.YouTubeVideoId)
            .OnDelete(DeleteBehavior.Cascade)
            .IsRequired(false);

        builder.ToTable("GlossaryTerms");
    }
}
