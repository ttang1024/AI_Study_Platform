using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Infrastructure.Data.Configurations;

public class PageVisitConfiguration : IEntityTypeConfiguration<PageVisit>
{
    public void Configure(EntityTypeBuilder<PageVisit> builder)
    {
        builder.HasKey(v => v.Id);
        builder.Property(v => v.VisitorId).IsRequired().HasMaxLength(64);
        builder.Property(v => v.SessionId).IsRequired().HasMaxLength(64);
        builder.Property(v => v.Path).IsRequired().HasMaxLength(200);
        builder.Property(v => v.Referrer).HasMaxLength(200);
        builder.Property(v => v.Device).IsRequired().HasMaxLength(16);
        builder.Property(v => v.OccurredAt).IsRequired();

        // Every dashboard query is "the trailing N days, then group by something", so the time
        // column leads both indexes and the retention sweep rides the first one too.
        builder.HasIndex(v => v.OccurredAt);
        builder.HasIndex(v => new { v.OccurredAt, v.Path });

        // Anonymous visits are the majority of the table and keep a null user id; a signed-in
        // visitor's rows go with the account when it is erased, like every other per-user table.
        builder.HasOne(v => v.User)
            .WithMany()
            .HasForeignKey(v => v.UserId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
