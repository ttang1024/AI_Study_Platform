using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StudyPlatform.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddDocumentChatConversations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "chk_chat_messages_source",
                table: "ChatMessages");

            migrationBuilder.AddColumn<Guid>(
                name: "DocumentId",
                table: "ChatConversations",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "chk_chat_messages_source",
                table: "ChatMessages",
                sql: "(\"DocumentId\" IS NOT NULL AND \"YouTubeVideoId\" IS NULL AND \"SourceType\" = 'document') OR (\"YouTubeVideoId\" IS NOT NULL AND \"DocumentId\" IS NULL AND \"SourceType\" = 'video') OR (\"ChatConversationId\" IS NOT NULL AND \"DocumentId\" IS NULL AND \"YouTubeVideoId\" IS NULL AND \"SourceType\" = 'general')");

            migrationBuilder.CreateIndex(
                name: "IX_ChatConversations_DocumentId_UserId",
                table: "ChatConversations",
                columns: new[] { "DocumentId", "UserId" });

            migrationBuilder.AddForeignKey(
                name: "FK_ChatConversations_Documents_DocumentId",
                table: "ChatConversations",
                column: "DocumentId",
                principalTable: "Documents",
                principalColumn: "DocumentId",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ChatConversations_Documents_DocumentId",
                table: "ChatConversations");

            migrationBuilder.DropCheckConstraint(
                name: "chk_chat_messages_source",
                table: "ChatMessages");

            migrationBuilder.DropIndex(
                name: "IX_ChatConversations_DocumentId_UserId",
                table: "ChatConversations");

            migrationBuilder.DropColumn(
                name: "DocumentId",
                table: "ChatConversations");

            migrationBuilder.AddCheckConstraint(
                name: "chk_chat_messages_source",
                table: "ChatMessages",
                sql: "(\"DocumentId\" IS NOT NULL AND \"YouTubeVideoId\" IS NULL AND \"ChatConversationId\" IS NULL AND \"SourceType\" = 'document') OR (\"YouTubeVideoId\" IS NOT NULL AND \"DocumentId\" IS NULL AND \"SourceType\" = 'video') OR (\"ChatConversationId\" IS NOT NULL AND \"DocumentId\" IS NULL AND \"YouTubeVideoId\" IS NULL AND \"SourceType\" = 'general')");
        }
    }
}
