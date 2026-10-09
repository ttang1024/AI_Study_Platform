using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StudyPlatform.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class VideoTranscriptionRequested : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "TranscriptionRequestedAt",
                table: "Videos",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Videos_TranscriptionRequestedAt",
                table: "Videos",
                column: "TranscriptionRequestedAt",
                filter: "\"TranscriptionRequestedAt\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Videos_TranscriptionRequestedAt",
                table: "Videos");

            migrationBuilder.DropColumn(
                name: "TranscriptionRequestedAt",
                table: "Videos");
        }
    }
}
