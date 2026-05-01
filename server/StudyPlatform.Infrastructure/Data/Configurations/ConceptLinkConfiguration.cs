using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Infrastructure.Data.Configurations;

public class ConceptLinkConfiguration : IEntityTypeConfiguration<ConceptLink>
{
    public void Configure(EntityTypeBuilder<ConceptLink> builder)
    {
        builder.HasKey(l => l.ConceptLinkId);

        builder.Property(l => l.SourceEntityType).IsRequired().HasMaxLength(50);
        builder.Property(l => l.TargetEntityType).IsRequired().HasMaxLength(50);
        builder.Property(l => l.LinkLabel).HasMaxLength(100);
        builder.Property(l => l.CreatedAt).IsRequired();

        builder.HasIndex(l => l.UserId);

        builder.HasOne(l => l.User)
            .WithMany()
            .HasForeignKey(l => l.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
