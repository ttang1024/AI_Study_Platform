using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using StudyPlatform.Infrastructure.Data;

#nullable disable

namespace StudyPlatform.Infrastructure.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260513000100_EnsureYouTubeVideoTranscriptColumn")]
public partial class EnsureYouTubeVideoTranscriptColumn : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE "YouTubeVideos"
            ADD COLUMN IF NOT EXISTS "Transcript" text;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
    }
}
