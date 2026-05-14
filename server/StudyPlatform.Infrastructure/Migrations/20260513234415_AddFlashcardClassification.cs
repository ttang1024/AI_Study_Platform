using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StudyPlatform.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddFlashcardClassification : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Chapter",
                table: "Flashcards",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Difficulty",
                table: "Flashcards",
                type: "character varying(10)",
                maxLength: 10,
                nullable: false,
                defaultValue: "medium");

            migrationBuilder.AddColumn<List<string>>(
                name: "Tags",
                table: "Flashcards",
                type: "text[]",
                nullable: false,
                defaultValueSql: "'{}'::text[]");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Chapter",
                table: "Flashcards");

            migrationBuilder.DropColumn(
                name: "Difficulty",
                table: "Flashcards");

            migrationBuilder.DropColumn(
                name: "Tags",
                table: "Flashcards");
        }
    }
}
