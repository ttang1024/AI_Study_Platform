using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StudyPlatform.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddTranscriptToYouTubeVideo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Transcript",
                table: "YouTubeVideos",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Transcript",
                table: "YouTubeVideos");
        }
    }
}
