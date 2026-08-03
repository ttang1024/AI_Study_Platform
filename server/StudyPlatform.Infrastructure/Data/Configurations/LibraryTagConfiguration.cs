using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using StudyPlatform.Domain.Entities;

namespace StudyPlatform.Infrastructure.Data.Configurations;

public class LibraryTagConfiguration : IEntityTypeConfiguration<LibraryTag>
{
    public void Configure(EntityTypeBuilder<LibraryTag> builder)
    {
        builder.HasKey(t => t.LibraryTagId);

        builder.Property(t => t.Name).IsRequired().HasMaxLength(64);
        builder.Property(t => t.Kind).IsRequired().HasMaxLength(16);
        builder.Property(t => t.Color).HasMaxLength(16);
        builder.Property(t => t.Description).HasMaxLength(512);
        builder.Property(t => t.CreatedAt).IsRequired();
        builder.Property(t => t.UpdatedAt).IsRequired();

        // Case-insensitive uniqueness per user and kind, so "Physics" and "physics" cannot both
        // exist and split one folder's contents in two. Enforced here rather than only in the
        // handler because bulk-create paths would otherwise race past the check.
        builder.HasIndex(t => new { t.UserId, t.Kind, t.Name })
            .IsUnique()
            .HasDatabaseName("IX_LibraryTags_User_Kind_Name");

        builder.HasOne(t => t.User)
            .WithMany()
            .HasForeignKey(t => t.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class LibraryTagAssignmentConfiguration : IEntityTypeConfiguration<LibraryTagAssignment>
{
    public void Configure(EntityTypeBuilder<LibraryTagAssignment> builder)
    {
        // The natural key is the whole row — a tag either applies to an item or it does not, and a
        // surrogate id would let the same pair be inserted twice.
        builder.HasKey(a => new { a.LibraryTagId, a.ItemKind, a.ItemId });

        builder.Property(a => a.ItemKind).IsRequired().HasMaxLength(16);
        builder.Property(a => a.AssignedAt).IsRequired();

        // Serves "which tags does this item have?", the lookup the library list runs per page.
        builder.HasIndex(a => new { a.ItemKind, a.ItemId });

        builder.HasOne(a => a.Tag)
            .WithMany(t => t.Assignments)
            .HasForeignKey(a => a.LibraryTagId)
            .OnDelete(DeleteBehavior.Cascade);

        // No FK on ItemId: it points at Documents or Videos depending on ItemKind, which no single
        // constraint can express. Assignments are pruned explicitly when an item is deleted.
    }
}

public class SavedLibraryViewConfiguration : IEntityTypeConfiguration<SavedLibraryView>
{
    public void Configure(EntityTypeBuilder<SavedLibraryView> builder)
    {
        builder.HasKey(v => v.SavedLibraryViewId);

        builder.Property(v => v.Name).IsRequired().HasMaxLength(64);
        builder.Property(v => v.Icon).HasMaxLength(16);
        builder.Property(v => v.FiltersJson).IsRequired();
        builder.Property(v => v.CreatedAt).IsRequired();
        builder.Property(v => v.UpdatedAt).IsRequired();

        builder.HasIndex(v => new { v.UserId, v.Position });

        builder.HasOne(v => v.User)
            .WithMany()
            .HasForeignKey(v => v.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
