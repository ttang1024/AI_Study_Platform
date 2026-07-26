using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StudyPlatform.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSourceAnchorsToGeneratedArtifacts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "SourceAnchorJson",
                table: "Quizzes",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SourceAnchorJson",
                table: "GlossaryTerms",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SourceAnchorJson",
                table: "Flashcards",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SourceAnchorJson",
                table: "Quizzes");

            migrationBuilder.DropColumn(
                name: "SourceAnchorJson",
                table: "GlossaryTerms");

            migrationBuilder.DropColumn(
                name: "SourceAnchorJson",
                table: "Flashcards");
        }
    }
}
