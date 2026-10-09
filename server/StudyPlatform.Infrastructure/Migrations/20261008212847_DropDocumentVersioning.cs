using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StudyPlatform.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class DropDocumentVersioning : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
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
                name: "MindMapVersion",
                table: "Documents");

            migrationBuilder.DropColumn(
                name: "SourceChangedAt",
                table: "Documents");

            migrationBuilder.DropColumn(
                name: "SummaryVersion",
                table: "Documents");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "SourceVersion",
                table: "Quizzes",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "SourceVersion",
                table: "GlossaryTerms",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "SourceVersion",
                table: "Flashcards",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "ContentVersion",
                table: "Documents",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "MindMapVersion",
                table: "Documents",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "SourceChangedAt",
                table: "Documents",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SummaryVersion",
                table: "Documents",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }
    }
}
