using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Infrastructure.Data.Configurations;

public class QuizBattleConfiguration : IEntityTypeConfiguration<QuizBattle>
{
    public void Configure(EntityTypeBuilder<QuizBattle> builder)
    {
        builder.HasKey(b => b.QuizBattleId);
        builder.Property(b => b.Title).IsRequired().HasMaxLength(200);
        builder.Property(b => b.QuestionsJson).IsRequired();
        builder.Property(b => b.Status).IsRequired().HasMaxLength(20);

        builder.HasIndex(b => new { b.GroupId, b.CreatedAt });

        builder.HasOne(b => b.Group)
            .WithMany()
            .HasForeignKey(b => b.GroupId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class QuizBattleEntryConfiguration : IEntityTypeConfiguration<QuizBattleEntry>
{
    public void Configure(EntityTypeBuilder<QuizBattleEntry> builder)
    {
        builder.HasKey(e => e.QuizBattleEntryId);
        builder.Property(e => e.AnswersJson).IsRequired();

        builder.HasIndex(e => new { e.BattleId, e.UserId }).IsUnique();

        builder.HasOne(e => e.Battle)
            .WithMany(b => b.Entries)
            .HasForeignKey(e => e.BattleId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(e => e.User)
            .WithMany()
            .HasForeignKey(e => e.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
