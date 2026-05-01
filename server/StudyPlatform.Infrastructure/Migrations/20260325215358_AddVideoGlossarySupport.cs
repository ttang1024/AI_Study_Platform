using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StudyPlatform.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddVideoGlossarySupport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<Guid>(
                name: "DocumentId",
                table: "GlossaryTerms",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<Guid>(
                name: "YouTubeVideoId",
                table: "GlossaryTerms",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_GlossaryTerms_YouTubeVideoId",
                table: "GlossaryTerms",
                column: "YouTubeVideoId");

            migrationBuilder.AddForeignKey(
                name: "FK_GlossaryTerms_YouTubeVideos_YouTubeVideoId",
                table: "GlossaryTerms",
                column: "YouTubeVideoId",
                principalTable: "YouTubeVideos",
                principalColumn: "YouTubeVideoId",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_GlossaryTerms_YouTubeVideos_YouTubeVideoId",
                table: "GlossaryTerms");

            migrationBuilder.DropIndex(
                name: "IX_GlossaryTerms_YouTubeVideoId",
                table: "GlossaryTerms");

            migrationBuilder.DropColumn(
                name: "YouTubeVideoId",
                table: "GlossaryTerms");

            migrationBuilder.AlterColumn<Guid>(
                name: "DocumentId",
                table: "GlossaryTerms",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);
        }
    }
}
