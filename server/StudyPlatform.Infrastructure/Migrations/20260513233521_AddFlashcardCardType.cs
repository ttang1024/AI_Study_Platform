using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StudyPlatform.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddFlashcardCardType : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CardType",
                table: "Flashcards",
                type: "character varying(10)",
                maxLength: 10,
                nullable: false,
                defaultValue: "basic");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CardType",
                table: "Flashcards");
        }
    }
}
