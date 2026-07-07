using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StudyPlatform.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RenameYouTubeVideoToVideo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ChatConversations_YouTubeVideos_YouTubeVideoId",
                table: "ChatConversations");

            migrationBuilder.DropForeignKey(
                name: "FK_ChatMessages_YouTubeVideos_YouTubeVideoId",
                table: "ChatMessages");

            migrationBuilder.DropForeignKey(
                name: "FK_Flashcards_YouTubeVideos_YouTubeVideoId",
                table: "Flashcards");

            migrationBuilder.DropForeignKey(
                name: "FK_GlossaryTerms_YouTubeVideos_YouTubeVideoId",
                table: "GlossaryTerms");

            migrationBuilder.DropForeignKey(
                name: "FK_Notes_YouTubeVideos_YouTubeVideoId",
                table: "Notes");

            migrationBuilder.DropForeignKey(
                name: "FK_QuizSubmissions_YouTubeVideos_YouTubeVideoId",
                table: "QuizSubmissions");

            migrationBuilder.DropForeignKey(
                name: "FK_Quizzes_YouTubeVideos_YouTubeVideoId",
                table: "Quizzes");

            // Rename in place (no drop/create) to preserve existing rows.
            migrationBuilder.RenameTable(
                name: "YouTubeTranscriptEntries",
                newName: "VideoTranscriptEntries");

            migrationBuilder.RenameTable(
                name: "YouTubeVideos",
                newName: "Videos");

            migrationBuilder.Sql(
                "ALTER TABLE \"VideoTranscriptEntries\" RENAME CONSTRAINT \"PK_YouTubeTranscriptEntries\" TO \"PK_VideoTranscriptEntries\";");

            migrationBuilder.Sql(
                "ALTER TABLE \"Videos\" RENAME CONSTRAINT \"PK_YouTubeVideos\" TO \"PK_Videos\";");

            migrationBuilder.Sql(
                "ALTER TABLE \"Videos\" RENAME CONSTRAINT \"FK_YouTubeVideos_Courses_CourseId\" TO \"FK_Videos_Courses_CourseId\";");

            migrationBuilder.Sql(
                "ALTER TABLE \"Videos\" RENAME CONSTRAINT \"FK_YouTubeVideos_Users_UserId\" TO \"FK_Videos_Users_UserId\";");

            migrationBuilder.RenameIndex(
                name: "IX_YouTubeTranscriptEntries_ExpiresAt",
                table: "VideoTranscriptEntries",
                newName: "IX_VideoTranscriptEntries_ExpiresAt");

            migrationBuilder.RenameIndex(
                name: "IX_YouTubeVideos_CourseId",
                table: "Videos",
                newName: "IX_Videos_CourseId");

            migrationBuilder.RenameIndex(
                name: "IX_YouTubeVideos_UserId",
                table: "Videos",
                newName: "IX_Videos_UserId");

            // Old external site video id ("dQw4w9WgXcQ") must move out of the way
            // before the surrogate key below claims the name "VideoId".
            migrationBuilder.RenameColumn(
                name: "VideoId",
                table: "Videos",
                newName: "ExternalVideoId");

            migrationBuilder.RenameColumn(
                name: "YouTubeVideoId",
                table: "Videos",
                newName: "VideoId");

            migrationBuilder.DropCheckConstraint(
                name: "chk_quizzes_source",
                table: "Quizzes");

            migrationBuilder.DropCheckConstraint(
                name: "chk_quiz_submissions_source",
                table: "QuizSubmissions");

            migrationBuilder.DropCheckConstraint(
                name: "chk_notes_source",
                table: "Notes");

            migrationBuilder.DropCheckConstraint(
                name: "chk_flashcards_source",
                table: "Flashcards");

            migrationBuilder.DropCheckConstraint(
                name: "chk_chat_messages_source",
                table: "ChatMessages");

            migrationBuilder.RenameColumn(
                name: "YouTubeVideoId",
                table: "WorkedProblems",
                newName: "VideoId");

            migrationBuilder.RenameColumn(
                name: "YouTubeVideoId",
                table: "Quizzes",
                newName: "VideoId");

            migrationBuilder.RenameIndex(
                name: "IX_Quizzes_YouTubeVideoId",
                table: "Quizzes",
                newName: "IX_Quizzes_VideoId");

            migrationBuilder.RenameColumn(
                name: "YouTubeVideoId",
                table: "QuizSubmissions",
                newName: "VideoId");

            migrationBuilder.RenameIndex(
                name: "IX_QuizSubmissions_YouTubeVideoId_UserId",
                table: "QuizSubmissions",
                newName: "IX_QuizSubmissions_VideoId_UserId");

            migrationBuilder.RenameColumn(
                name: "YouTubeVideoId",
                table: "Notes",
                newName: "VideoId");

            migrationBuilder.RenameIndex(
                name: "IX_Notes_YouTubeVideoId",
                table: "Notes",
                newName: "IX_Notes_VideoId");

            migrationBuilder.RenameColumn(
                name: "YouTubeVideoId",
                table: "MistakeEntries",
                newName: "VideoId");

            migrationBuilder.RenameColumn(
                name: "YouTubeVideoId",
                table: "GlossaryTerms",
                newName: "VideoId");

            migrationBuilder.RenameIndex(
                name: "IX_GlossaryTerms_YouTubeVideoId",
                table: "GlossaryTerms",
                newName: "IX_GlossaryTerms_VideoId");

            migrationBuilder.RenameColumn(
                name: "YouTubeVideoId",
                table: "Flashcards",
                newName: "VideoId");

            migrationBuilder.RenameIndex(
                name: "IX_Flashcards_YouTubeVideoId",
                table: "Flashcards",
                newName: "IX_Flashcards_VideoId");

            migrationBuilder.RenameColumn(
                name: "YouTubeVideoId",
                table: "ChatMessages",
                newName: "VideoId");

            migrationBuilder.RenameIndex(
                name: "IX_ChatMessages_YouTubeVideoId",
                table: "ChatMessages",
                newName: "IX_ChatMessages_VideoId");

            migrationBuilder.RenameColumn(
                name: "YouTubeVideoId",
                table: "ChatConversations",
                newName: "VideoId");

            migrationBuilder.RenameIndex(
                name: "IX_ChatConversations_YouTubeVideoId_UserId",
                table: "ChatConversations",
                newName: "IX_ChatConversations_VideoId_UserId");

            migrationBuilder.AddCheckConstraint(
                name: "chk_quizzes_source",
                table: "Quizzes",
                sql: "(\"DocumentId\" IS NOT NULL AND \"VideoId\" IS NULL AND \"SourceType\" = 'document') OR (\"VideoId\" IS NOT NULL AND \"DocumentId\" IS NULL AND \"SourceType\" = 'video')");

            migrationBuilder.AddCheckConstraint(
                name: "chk_quiz_submissions_source",
                table: "QuizSubmissions",
                sql: "(\"DocumentId\" IS NOT NULL AND \"VideoId\" IS NULL AND \"SourceType\" = 'document') OR (\"VideoId\" IS NOT NULL AND \"DocumentId\" IS NULL AND \"SourceType\" = 'video')");

            migrationBuilder.AddCheckConstraint(
                name: "chk_notes_source",
                table: "Notes",
                sql: "(\"DocumentId\" IS NOT NULL AND \"VideoId\" IS NULL AND \"SourceType\" = 'document') OR (\"VideoId\" IS NOT NULL AND \"DocumentId\" IS NULL AND \"SourceType\" = 'video')");

            migrationBuilder.AddCheckConstraint(
                name: "chk_flashcards_source",
                table: "Flashcards",
                sql: "(\"DocumentId\" IS NOT NULL AND \"VideoId\" IS NULL AND \"SourceType\" = 'document') OR (\"VideoId\" IS NOT NULL AND \"DocumentId\" IS NULL AND \"SourceType\" = 'video')");

            migrationBuilder.AddCheckConstraint(
                name: "chk_chat_messages_source",
                table: "ChatMessages",
                sql: "(\"DocumentId\" IS NOT NULL AND \"VideoId\" IS NULL AND \"SourceType\" = 'document') OR (\"VideoId\" IS NOT NULL AND \"DocumentId\" IS NULL AND \"SourceType\" = 'video') OR (\"ChatConversationId\" IS NOT NULL AND \"DocumentId\" IS NULL AND \"VideoId\" IS NULL AND \"SourceType\" = 'general')");

            migrationBuilder.AddForeignKey(
                name: "FK_ChatConversations_Videos_VideoId",
                table: "ChatConversations",
                column: "VideoId",
                principalTable: "Videos",
                principalColumn: "VideoId",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_ChatMessages_Videos_VideoId",
                table: "ChatMessages",
                column: "VideoId",
                principalTable: "Videos",
                principalColumn: "VideoId",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Flashcards_Videos_VideoId",
                table: "Flashcards",
                column: "VideoId",
                principalTable: "Videos",
                principalColumn: "VideoId",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_GlossaryTerms_Videos_VideoId",
                table: "GlossaryTerms",
                column: "VideoId",
                principalTable: "Videos",
                principalColumn: "VideoId",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Notes_Videos_VideoId",
                table: "Notes",
                column: "VideoId",
                principalTable: "Videos",
                principalColumn: "VideoId",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_QuizSubmissions_Videos_VideoId",
                table: "QuizSubmissions",
                column: "VideoId",
                principalTable: "Videos",
                principalColumn: "VideoId",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Quizzes_Videos_VideoId",
                table: "Quizzes",
                column: "VideoId",
                principalTable: "Videos",
                principalColumn: "VideoId",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ChatConversations_Videos_VideoId",
                table: "ChatConversations");

            migrationBuilder.DropForeignKey(
                name: "FK_ChatMessages_Videos_VideoId",
                table: "ChatMessages");

            migrationBuilder.DropForeignKey(
                name: "FK_Flashcards_Videos_VideoId",
                table: "Flashcards");

            migrationBuilder.DropForeignKey(
                name: "FK_GlossaryTerms_Videos_VideoId",
                table: "GlossaryTerms");

            migrationBuilder.DropForeignKey(
                name: "FK_Notes_Videos_VideoId",
                table: "Notes");

            migrationBuilder.DropForeignKey(
                name: "FK_QuizSubmissions_Videos_VideoId",
                table: "QuizSubmissions");

            migrationBuilder.DropForeignKey(
                name: "FK_Quizzes_Videos_VideoId",
                table: "Quizzes");

            migrationBuilder.DropCheckConstraint(
                name: "chk_quizzes_source",
                table: "Quizzes");

            migrationBuilder.DropCheckConstraint(
                name: "chk_quiz_submissions_source",
                table: "QuizSubmissions");

            migrationBuilder.DropCheckConstraint(
                name: "chk_notes_source",
                table: "Notes");

            migrationBuilder.DropCheckConstraint(
                name: "chk_flashcards_source",
                table: "Flashcards");

            migrationBuilder.DropCheckConstraint(
                name: "chk_chat_messages_source",
                table: "ChatMessages");

            migrationBuilder.RenameColumn(
                name: "VideoId",
                table: "WorkedProblems",
                newName: "YouTubeVideoId");

            migrationBuilder.RenameColumn(
                name: "VideoId",
                table: "Quizzes",
                newName: "YouTubeVideoId");

            migrationBuilder.RenameIndex(
                name: "IX_Quizzes_VideoId",
                table: "Quizzes",
                newName: "IX_Quizzes_YouTubeVideoId");

            migrationBuilder.RenameColumn(
                name: "VideoId",
                table: "QuizSubmissions",
                newName: "YouTubeVideoId");

            migrationBuilder.RenameIndex(
                name: "IX_QuizSubmissions_VideoId_UserId",
                table: "QuizSubmissions",
                newName: "IX_QuizSubmissions_YouTubeVideoId_UserId");

            migrationBuilder.RenameColumn(
                name: "VideoId",
                table: "Notes",
                newName: "YouTubeVideoId");

            migrationBuilder.RenameIndex(
                name: "IX_Notes_VideoId",
                table: "Notes",
                newName: "IX_Notes_YouTubeVideoId");

            migrationBuilder.RenameColumn(
                name: "VideoId",
                table: "MistakeEntries",
                newName: "YouTubeVideoId");

            migrationBuilder.RenameColumn(
                name: "VideoId",
                table: "GlossaryTerms",
                newName: "YouTubeVideoId");

            migrationBuilder.RenameIndex(
                name: "IX_GlossaryTerms_VideoId",
                table: "GlossaryTerms",
                newName: "IX_GlossaryTerms_YouTubeVideoId");

            migrationBuilder.RenameColumn(
                name: "VideoId",
                table: "Flashcards",
                newName: "YouTubeVideoId");

            migrationBuilder.RenameIndex(
                name: "IX_Flashcards_VideoId",
                table: "Flashcards",
                newName: "IX_Flashcards_YouTubeVideoId");

            migrationBuilder.RenameColumn(
                name: "VideoId",
                table: "ChatMessages",
                newName: "YouTubeVideoId");

            migrationBuilder.RenameIndex(
                name: "IX_ChatMessages_VideoId",
                table: "ChatMessages",
                newName: "IX_ChatMessages_YouTubeVideoId");

            migrationBuilder.RenameColumn(
                name: "VideoId",
                table: "ChatConversations",
                newName: "YouTubeVideoId");

            migrationBuilder.RenameIndex(
                name: "IX_ChatConversations_VideoId_UserId",
                table: "ChatConversations",
                newName: "IX_ChatConversations_YouTubeVideoId_UserId");

            migrationBuilder.AddCheckConstraint(
                name: "chk_quizzes_source",
                table: "Quizzes",
                sql: "(\"DocumentId\" IS NOT NULL AND \"YouTubeVideoId\" IS NULL AND \"SourceType\" = 'document') OR (\"YouTubeVideoId\" IS NOT NULL AND \"DocumentId\" IS NULL AND \"SourceType\" = 'video')");

            migrationBuilder.AddCheckConstraint(
                name: "chk_quiz_submissions_source",
                table: "QuizSubmissions",
                sql: "(\"DocumentId\" IS NOT NULL AND \"YouTubeVideoId\" IS NULL AND \"SourceType\" = 'document') OR (\"YouTubeVideoId\" IS NOT NULL AND \"DocumentId\" IS NULL AND \"SourceType\" = 'video')");

            migrationBuilder.AddCheckConstraint(
                name: "chk_notes_source",
                table: "Notes",
                sql: "(\"DocumentId\" IS NOT NULL AND \"YouTubeVideoId\" IS NULL AND \"SourceType\" = 'document') OR (\"YouTubeVideoId\" IS NOT NULL AND \"DocumentId\" IS NULL AND \"SourceType\" = 'video')");

            migrationBuilder.AddCheckConstraint(
                name: "chk_flashcards_source",
                table: "Flashcards",
                sql: "(\"DocumentId\" IS NOT NULL AND \"YouTubeVideoId\" IS NULL AND \"SourceType\" = 'document') OR (\"YouTubeVideoId\" IS NOT NULL AND \"DocumentId\" IS NULL AND \"SourceType\" = 'video')");

            migrationBuilder.AddCheckConstraint(
                name: "chk_chat_messages_source",
                table: "ChatMessages",
                sql: "(\"DocumentId\" IS NOT NULL AND \"YouTubeVideoId\" IS NULL AND \"SourceType\" = 'document') OR (\"YouTubeVideoId\" IS NOT NULL AND \"DocumentId\" IS NULL AND \"SourceType\" = 'video') OR (\"ChatConversationId\" IS NOT NULL AND \"DocumentId\" IS NULL AND \"YouTubeVideoId\" IS NULL AND \"SourceType\" = 'general')");

            // Reverse the surrogate-key rename before restoring the external video id's name,
            // mirroring the collision-avoidance order used in Up().
            migrationBuilder.RenameColumn(
                name: "VideoId",
                table: "Videos",
                newName: "YouTubeVideoId");

            migrationBuilder.RenameColumn(
                name: "ExternalVideoId",
                table: "Videos",
                newName: "VideoId");

            migrationBuilder.RenameIndex(
                name: "IX_Videos_UserId",
                table: "Videos",
                newName: "IX_YouTubeVideos_UserId");

            migrationBuilder.RenameIndex(
                name: "IX_Videos_CourseId",
                table: "Videos",
                newName: "IX_YouTubeVideos_CourseId");

            migrationBuilder.RenameIndex(
                name: "IX_VideoTranscriptEntries_ExpiresAt",
                table: "VideoTranscriptEntries",
                newName: "IX_YouTubeTranscriptEntries_ExpiresAt");

            migrationBuilder.Sql(
                "ALTER TABLE \"Videos\" RENAME CONSTRAINT \"FK_Videos_Users_UserId\" TO \"FK_YouTubeVideos_Users_UserId\";");

            migrationBuilder.Sql(
                "ALTER TABLE \"Videos\" RENAME CONSTRAINT \"FK_Videos_Courses_CourseId\" TO \"FK_YouTubeVideos_Courses_CourseId\";");

            migrationBuilder.Sql(
                "ALTER TABLE \"Videos\" RENAME CONSTRAINT \"PK_Videos\" TO \"PK_YouTubeVideos\";");

            migrationBuilder.Sql(
                "ALTER TABLE \"VideoTranscriptEntries\" RENAME CONSTRAINT \"PK_VideoTranscriptEntries\" TO \"PK_YouTubeTranscriptEntries\";");

            migrationBuilder.RenameTable(
                name: "Videos",
                newName: "YouTubeVideos");

            migrationBuilder.RenameTable(
                name: "VideoTranscriptEntries",
                newName: "YouTubeTranscriptEntries");

            migrationBuilder.AddForeignKey(
                name: "FK_ChatConversations_YouTubeVideos_YouTubeVideoId",
                table: "ChatConversations",
                column: "YouTubeVideoId",
                principalTable: "YouTubeVideos",
                principalColumn: "YouTubeVideoId",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_ChatMessages_YouTubeVideos_YouTubeVideoId",
                table: "ChatMessages",
                column: "YouTubeVideoId",
                principalTable: "YouTubeVideos",
                principalColumn: "YouTubeVideoId",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Flashcards_YouTubeVideos_YouTubeVideoId",
                table: "Flashcards",
                column: "YouTubeVideoId",
                principalTable: "YouTubeVideos",
                principalColumn: "YouTubeVideoId",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_GlossaryTerms_YouTubeVideos_YouTubeVideoId",
                table: "GlossaryTerms",
                column: "YouTubeVideoId",
                principalTable: "YouTubeVideos",
                principalColumn: "YouTubeVideoId",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Notes_YouTubeVideos_YouTubeVideoId",
                table: "Notes",
                column: "YouTubeVideoId",
                principalTable: "YouTubeVideos",
                principalColumn: "YouTubeVideoId",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_QuizSubmissions_YouTubeVideos_YouTubeVideoId",
                table: "QuizSubmissions",
                column: "YouTubeVideoId",
                principalTable: "YouTubeVideos",
                principalColumn: "YouTubeVideoId",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Quizzes_YouTubeVideos_YouTubeVideoId",
                table: "Quizzes",
                column: "YouTubeVideoId",
                principalTable: "YouTubeVideos",
                principalColumn: "YouTubeVideoId",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
