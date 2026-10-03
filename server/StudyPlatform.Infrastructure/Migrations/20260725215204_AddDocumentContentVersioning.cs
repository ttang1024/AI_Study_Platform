using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StudyPlatform.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddDocumentContentVersioning : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "SourceVersion",
                table: "Quizzes",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<int>(
                name: "SourceVersion",
                table: "GlossaryTerms",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<int>(
                name: "SourceVersion",
                table: "Flashcards",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<int>(
                name: "ContentVersion",
                table: "Documents",
                type: "integer",
                nullable: false,
                // 1, not EF's generated 0: existing documents are at their first version, and
                // starting them at 0 would make a legacy document's first replacement land on 1,
                // silently skipping any staleness rule expressed relative to the initial version.
                defaultValue: 1);

            migrationBuilder.AddColumn<DateTime>(
                name: "SourceChangedAt",
                table: "Documents",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SourceVersion",
                table: "Quizzes");

            migrationBuilder.DropColumn(
                name: "SourceVersion",
                table: "GlossaryTerms");

            migrationBuilder.DropColumn(
                name: "SourceVersion",
                table: "Flashcards");

            migrationBuilder.DropColumn(
                name: "ContentVersion",
                table: "Documents");

            migrationBuilder.DropColumn(
                name: "SourceChangedAt",
                table: "Documents");
        }
    }
}
