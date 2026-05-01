using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Infrastructure.Data.Configurations;

public class GlossaryMasteredConfiguration : IEntityTypeConfiguration<GlossaryMastered>
{
    public void Configure(EntityTypeBuilder<GlossaryMastered> builder)
    {
        builder.HasKey(m => m.Id);

        builder.HasIndex(m => new { m.UserId, m.GlossaryTermId }).IsUnique();

        builder.Property(m => m.MasteredAt).IsRequired();

        builder.HasOne(m => m.GlossaryTerm)
            .WithMany()
            .HasForeignKey(m => m.GlossaryTermId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
