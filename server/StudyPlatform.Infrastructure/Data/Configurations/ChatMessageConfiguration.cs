using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Infrastructure.Data.Configurations;

public class ChatMessageConfiguration : IEntityTypeConfiguration<ChatMessage>
{
    public void Configure(EntityTypeBuilder<ChatMessage> builder)
    {
        builder.HasKey(c => c.MessageId);
        builder.Property(c => c.Role).IsRequired().HasMaxLength(20);
        builder.Property(c => c.Content).IsRequired().HasColumnType("text");
        builder.Property(c => c.AttachmentsJson).HasColumnType("jsonb");
        builder.Property(c => c.SourceType).IsRequired().HasMaxLength(20).HasDefaultValue("document");
        builder.Property(c => c.CreatedAt).IsRequired();

        builder.HasOne(c => c.Document)
            .WithMany(d => d.ChatMessages)
            .HasForeignKey(c => c.DocumentId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(c => c.YouTubeVideo)
            .WithMany(v => v.ChatMessages)
            .HasForeignKey(c => c.YouTubeVideoId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(c => c.ChatConversation)
            .WithMany(c => c.Messages)
            .HasForeignKey(c => c.ChatConversationId)
            .IsRequired(false)
            .OnDelete(DeleteBehavior.Cascade);

        // Video/document messages may carry a ChatConversationId (per-source
        // threads); messages predating threads have none.
        builder.ToTable(t => t.HasCheckConstraint("chk_chat_messages_source",
            "(\"DocumentId\" IS NOT NULL AND \"YouTubeVideoId\" IS NULL AND \"SourceType\" = 'document') OR " +
            "(\"YouTubeVideoId\" IS NOT NULL AND \"DocumentId\" IS NULL AND \"SourceType\" = 'video') OR " +
            "(\"ChatConversationId\" IS NOT NULL AND \"DocumentId\" IS NULL AND \"YouTubeVideoId\" IS NULL AND \"SourceType\" = 'general')"));
    }
}
