using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Infrastructure.Data.Configurations;

public class DataExportRequestConfiguration : IEntityTypeConfiguration<DataExportRequest>
{
    public void Configure(EntityTypeBuilder<DataExportRequest> builder)
    {
        builder.HasKey(r => r.DataExportRequestId);

        builder.Property(r => r.Status).IsRequired().HasMaxLength(16);
        builder.Property(r => r.BlobUrl).HasMaxLength(1024);
        builder.Property(r => r.ErrorMessage).HasMaxLength(1024);
        builder.Property(r => r.CreatedAt).IsRequired();

        builder.HasIndex(r => new { r.UserId, r.CreatedAt });

        // The worker's claim query is "oldest pending first", so status leads the index.
        builder.HasIndex(r => new { r.Status, r.CreatedAt });

        builder.HasOne(r => r.User)
            .WithMany()
            .HasForeignKey(r => r.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
