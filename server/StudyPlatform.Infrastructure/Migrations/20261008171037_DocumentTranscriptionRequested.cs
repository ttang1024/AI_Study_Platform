using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StudyPlatform.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class DocumentTranscriptionRequested : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "TranscriptionRequestedAt",
                table: "Documents",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Documents_TranscriptionRequestedAt",
                table: "Documents",
                column: "TranscriptionRequestedAt",
                filter: "\"TranscriptionRequestedAt\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Documents_TranscriptionRequestedAt",
                table: "Documents");

            migrationBuilder.DropColumn(
                name: "TranscriptionRequestedAt",
                table: "Documents");
        }
    }
}
