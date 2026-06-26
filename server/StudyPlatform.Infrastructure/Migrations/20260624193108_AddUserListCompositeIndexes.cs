using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StudyPlatform.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddUserListCompositeIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_QuizSubmissions_UserId_SubmittedAt",
                table: "QuizSubmissions",
                columns: new[] { "UserId", "SubmittedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Notes_UserId_UpdatedAt",
                table: "Notes",
                columns: new[] { "UserId", "UpdatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_GlossaryTerms_UserId_Term",
                table: "GlossaryTerms",
                columns: new[] { "UserId", "Term" });

            migrationBuilder.CreateIndex(
                name: "IX_Flashcards_UserId_CreatedAt",
                table: "Flashcards",
                columns: new[] { "UserId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Documents_UserId_CreatedAt",
                table: "Documents",
                columns: new[] { "UserId", "CreatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_QuizSubmissions_UserId_SubmittedAt",
                table: "QuizSubmissions");

            migrationBuilder.DropIndex(
                name: "IX_Notes_UserId_UpdatedAt",
                table: "Notes");

            migrationBuilder.DropIndex(
                name: "IX_GlossaryTerms_UserId_Term",
                table: "GlossaryTerms");

            migrationBuilder.DropIndex(
                name: "IX_Flashcards_UserId_CreatedAt",
                table: "Flashcards");

            migrationBuilder.DropIndex(
                name: "IX_Documents_UserId_CreatedAt",
                table: "Documents");
        }
    }
}
