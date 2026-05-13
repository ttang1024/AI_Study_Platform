using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StudyPlatform.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddGeneralChatConversations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "chk_chat_messages_source",
                table: "ChatMessages");

            migrationBuilder.CreateTable(
                name: "ChatConversations",
                columns: table => new
                {
                    ConversationId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChatConversations", x => x.ConversationId);
                });

            migrationBuilder.AddColumn<Guid>(
                name: "ChatConversationId",
                table: "ChatMessages",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_ChatMessages_ChatConversationId",
                table: "ChatMessages",
                column: "ChatConversationId");

            migrationBuilder.CreateIndex(
                name: "IX_ChatConversations_UserId_UpdatedAt",
                table: "ChatConversations",
                columns: new[] { "UserId", "UpdatedAt" });

            migrationBuilder.AddForeignKey(
                name: "FK_ChatMessages_ChatConversations_ChatConversationId",
                table: "ChatMessages",
                column: "ChatConversationId",
                principalTable: "ChatConversations",
                principalColumn: "ConversationId",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddCheckConstraint(
                name: "chk_chat_messages_source",
                table: "ChatMessages",
                sql: "(\"DocumentId\" IS NOT NULL AND \"YouTubeVideoId\" IS NULL AND \"ChatConversationId\" IS NULL AND \"SourceType\" = 'document') OR " +
                     "(\"YouTubeVideoId\" IS NOT NULL AND \"DocumentId\" IS NULL AND \"ChatConversationId\" IS NULL AND \"SourceType\" = 'video') OR " +
                     "(\"ChatConversationId\" IS NOT NULL AND \"DocumentId\" IS NULL AND \"YouTubeVideoId\" IS NULL AND \"SourceType\" = 'general')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "chk_chat_messages_source",
                table: "ChatMessages");

            migrationBuilder.DropForeignKey(
                name: "FK_ChatMessages_ChatConversations_ChatConversationId",
                table: "ChatMessages");

            migrationBuilder.DropTable(
                name: "ChatConversations");

            migrationBuilder.DropIndex(
                name: "IX_ChatMessages_ChatConversationId",
                table: "ChatMessages");

            migrationBuilder.DropColumn(
                name: "ChatConversationId",
                table: "ChatMessages");

            migrationBuilder.AddCheckConstraint(
                name: "chk_chat_messages_source",
                table: "ChatMessages",
                sql: "(\"DocumentId\" IS NOT NULL AND \"YouTubeVideoId\" IS NULL AND \"SourceType\" = 'document') OR " +
                     "(\"YouTubeVideoId\" IS NOT NULL AND \"DocumentId\" IS NULL AND \"SourceType\" = 'video')");
        }
    }
}
