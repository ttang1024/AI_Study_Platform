using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StudyPlatform.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddMistakeFlashcardLink : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "FlashcardId",
                table: "MistakeEntries",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_MistakeEntries_FlashcardId",
                table: "MistakeEntries",
                column: "FlashcardId");

            migrationBuilder.AddForeignKey(
                name: "FK_MistakeEntries_Flashcards_FlashcardId",
                table: "MistakeEntries",
                column: "FlashcardId",
                principalTable: "Flashcards",
                principalColumn: "FlashcardId",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_MistakeEntries_Flashcards_FlashcardId",
                table: "MistakeEntries");

            migrationBuilder.DropIndex(
                name: "IX_MistakeEntries_FlashcardId",
                table: "MistakeEntries");

            migrationBuilder.DropColumn(
                name: "FlashcardId",
                table: "MistakeEntries");
        }
    }
}
