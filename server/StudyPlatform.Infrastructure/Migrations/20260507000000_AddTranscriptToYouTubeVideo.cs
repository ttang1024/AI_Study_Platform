using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using StudyPlatform.Infrastructure.Data;

#nullable disable

namespace StudyPlatform.Infrastructure.Migrations
{
    /// <inheritdoc />
    [DbContext(typeof(AppDbContext))]
    [Migration("20260507000000_AddTranscriptToYouTubeVideo")]
    public partial class AddTranscriptToYouTubeVideo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "YouTubeVideos"
                ADD COLUMN IF NOT EXISTS "Transcript" text;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE "YouTubeVideos"
                DROP COLUMN IF EXISTS "Transcript";
                """);
        }
    }
}
