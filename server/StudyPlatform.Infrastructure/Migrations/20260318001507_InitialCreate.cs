using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StudyPlatform.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "FlashcardReviews",
                columns: table => new
                {
                    ReviewId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    FlashcardId = table.Column<Guid>(type: "uuid", nullable: false),
                    ReviewedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FlashcardReviews", x => x.ReviewId);
                });

            migrationBuilder.CreateTable(
                name: "QuizAttempts",
                columns: table => new
                {
                    AttemptId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    QuizId = table.Column<Guid>(type: "uuid", nullable: false),
                    IsCorrect = table.Column<bool>(type: "boolean", nullable: false),
                    AttemptedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QuizAttempts", x => x.AttemptId);
                });

            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Email = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    PasswordHash = table.Column<string>(type: "text", nullable: false),
                    FullName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    IsEmailVerified = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.UserId);
                });

            migrationBuilder.CreateTable(
                name: "Courses",
                columns: table => new
                {
                    CourseId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CourseName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    CourseColor = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Courses", x => x.CourseId);
                    table.ForeignKey(
                        name: "FK_Courses_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "OtpCodes",
                columns: table => new
                {
                    OtpId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: true),
                    Email = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                    Code = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    Purpose = table.Column<int>(type: "integer", nullable: false),
                    IsUsed = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OtpCodes", x => x.OtpId);
                    table.ForeignKey(
                        name: "FK_OtpCodes_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "RefreshTokens",
                columns: table => new
                {
                    TokenId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Token = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IsRevoked = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RefreshTokens", x => x.TokenId);
                    table.ForeignKey(
                        name: "FK_RefreshTokens_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Documents",
                columns: table => new
                {
                    DocumentId = table.Column<Guid>(type: "uuid", nullable: false),
                    CourseId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    FileName = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    BlobUrl = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    ContentType = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    FileSize = table.Column<long>(type: "bigint", nullable: false),
                    Summary = table.Column<string>(type: "text", nullable: true),
                    MindMapText = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Documents", x => x.DocumentId);
                    table.ForeignKey(
                        name: "FK_Documents_Courses_CourseId",
                        column: x => x.CourseId,
                        principalTable: "Courses",
                        principalColumn: "CourseId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Documents_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "UserId");
                });

            migrationBuilder.CreateTable(
                name: "YouTubeVideos",
                columns: table => new
                {
                    YouTubeVideoId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    CourseId = table.Column<Guid>(type: "uuid", nullable: false),
                    VideoId = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    VideoUrl = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Title = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    ThumbnailUrl = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Summary = table.Column<string>(type: "text", nullable: true),
                    MindMapText = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_YouTubeVideos", x => x.YouTubeVideoId);
                    table.ForeignKey(
                        name: "FK_YouTubeVideos_Courses_CourseId",
                        column: x => x.CourseId,
                        principalTable: "Courses",
                        principalColumn: "CourseId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_YouTubeVideos_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "UserId");
                });

            migrationBuilder.CreateTable(
                name: "ChatMessages",
                columns: table => new
                {
                    MessageId = table.Column<Guid>(type: "uuid", nullable: false),
                    DocumentId = table.Column<Guid>(type: "uuid", nullable: true),
                    YouTubeVideoId = table.Column<Guid>(type: "uuid", nullable: true),
                    SourceType = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "document"),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Role = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Content = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChatMessages", x => x.MessageId);
                    table.CheckConstraint("chk_chat_messages_source", "(\"DocumentId\" IS NOT NULL AND \"YouTubeVideoId\" IS NULL AND \"SourceType\" = 'document') OR (\"YouTubeVideoId\" IS NOT NULL AND \"DocumentId\" IS NULL AND \"SourceType\" = 'video')");
                    table.ForeignKey(
                        name: "FK_ChatMessages_Documents_DocumentId",
                        column: x => x.DocumentId,
                        principalTable: "Documents",
                        principalColumn: "DocumentId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ChatMessages_YouTubeVideos_YouTubeVideoId",
                        column: x => x.YouTubeVideoId,
                        principalTable: "YouTubeVideos",
                        principalColumn: "YouTubeVideoId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Flashcards",
                columns: table => new
                {
                    FlashcardId = table.Column<Guid>(type: "uuid", nullable: false),
                    DocumentId = table.Column<Guid>(type: "uuid", nullable: true),
                    YouTubeVideoId = table.Column<Guid>(type: "uuid", nullable: true),
                    SourceType = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "document"),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Front = table.Column<string>(type: "text", nullable: false),
                    Back = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Flashcards", x => x.FlashcardId);
                    table.CheckConstraint("chk_flashcards_source", "(\"DocumentId\" IS NOT NULL AND \"YouTubeVideoId\" IS NULL AND \"SourceType\" = 'document') OR (\"YouTubeVideoId\" IS NOT NULL AND \"DocumentId\" IS NULL AND \"SourceType\" = 'video')");
                    table.ForeignKey(
                        name: "FK_Flashcards_Documents_DocumentId",
                        column: x => x.DocumentId,
                        principalTable: "Documents",
                        principalColumn: "DocumentId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Flashcards_YouTubeVideos_YouTubeVideoId",
                        column: x => x.YouTubeVideoId,
                        principalTable: "YouTubeVideos",
                        principalColumn: "YouTubeVideoId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Notes",
                columns: table => new
                {
                    NoteId = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    DocumentId = table.Column<Guid>(type: "uuid", nullable: true),
                    YouTubeVideoId = table.Column<Guid>(type: "uuid", nullable: true),
                    SourceType = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "document"),
                    Content = table.Column<string>(type: "text", nullable: false),
                    Title = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Notes", x => x.NoteId);
                    table.CheckConstraint("chk_notes_source", "(\"DocumentId\" IS NOT NULL AND \"YouTubeVideoId\" IS NULL AND \"SourceType\" = 'document') OR (\"YouTubeVideoId\" IS NOT NULL AND \"DocumentId\" IS NULL AND \"SourceType\" = 'video')");
                    table.ForeignKey(
                        name: "FK_Notes_Documents_DocumentId",
                        column: x => x.DocumentId,
                        principalTable: "Documents",
                        principalColumn: "DocumentId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Notes_YouTubeVideos_YouTubeVideoId",
                        column: x => x.YouTubeVideoId,
                        principalTable: "YouTubeVideos",
                        principalColumn: "YouTubeVideoId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "QuizSubmissions",
                columns: table => new
                {
                    SubmissionId = table.Column<Guid>(type: "uuid", nullable: false),
                    DocumentId = table.Column<Guid>(type: "uuid", nullable: true),
                    YouTubeVideoId = table.Column<Guid>(type: "uuid", nullable: true),
                    SourceType = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "document"),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    AnswersJson = table.Column<string>(type: "jsonb", nullable: false),
                    Score = table.Column<int>(type: "integer", nullable: false),
                    Total = table.Column<int>(type: "integer", nullable: false),
                    SubmittedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QuizSubmissions", x => x.SubmissionId);
                    table.CheckConstraint("chk_quiz_submissions_source", "(\"DocumentId\" IS NOT NULL AND \"YouTubeVideoId\" IS NULL AND \"SourceType\" = 'document') OR (\"YouTubeVideoId\" IS NOT NULL AND \"DocumentId\" IS NULL AND \"SourceType\" = 'video')");
                    table.ForeignKey(
                        name: "FK_QuizSubmissions_Documents_DocumentId",
                        column: x => x.DocumentId,
                        principalTable: "Documents",
                        principalColumn: "DocumentId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_QuizSubmissions_YouTubeVideos_YouTubeVideoId",
                        column: x => x.YouTubeVideoId,
                        principalTable: "YouTubeVideos",
                        principalColumn: "YouTubeVideoId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Quizzes",
                columns: table => new
                {
                    QuizId = table.Column<Guid>(type: "uuid", nullable: false),
                    DocumentId = table.Column<Guid>(type: "uuid", nullable: true),
                    YouTubeVideoId = table.Column<Guid>(type: "uuid", nullable: true),
                    SourceType = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "document"),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Question = table.Column<string>(type: "text", nullable: false),
                    OptionsJson = table.Column<string>(type: "jsonb", nullable: false),
                    CorrectAnswer = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    Explanation = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Quizzes", x => x.QuizId);
                    table.CheckConstraint("chk_quizzes_source", "(\"DocumentId\" IS NOT NULL AND \"YouTubeVideoId\" IS NULL AND \"SourceType\" = 'document') OR (\"YouTubeVideoId\" IS NOT NULL AND \"DocumentId\" IS NULL AND \"SourceType\" = 'video')");
                    table.ForeignKey(
                        name: "FK_Quizzes_Documents_DocumentId",
                        column: x => x.DocumentId,
                        principalTable: "Documents",
                        principalColumn: "DocumentId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Quizzes_YouTubeVideos_YouTubeVideoId",
                        column: x => x.YouTubeVideoId,
                        principalTable: "YouTubeVideos",
                        principalColumn: "YouTubeVideoId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ChatMessages_DocumentId",
                table: "ChatMessages",
                column: "DocumentId");

            migrationBuilder.CreateIndex(
                name: "IX_ChatMessages_YouTubeVideoId",
                table: "ChatMessages",
                column: "YouTubeVideoId");

            migrationBuilder.CreateIndex(
                name: "IX_Courses_UserId",
                table: "Courses",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Documents_CourseId",
                table: "Documents",
                column: "CourseId");

            migrationBuilder.CreateIndex(
                name: "IX_Documents_UserId",
                table: "Documents",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_FlashcardReviews_UserId_ReviewedAt",
                table: "FlashcardReviews",
                columns: new[] { "UserId", "ReviewedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Flashcards_DocumentId",
                table: "Flashcards",
                column: "DocumentId");

            migrationBuilder.CreateIndex(
                name: "IX_Flashcards_YouTubeVideoId",
                table: "Flashcards",
                column: "YouTubeVideoId");

            migrationBuilder.CreateIndex(
                name: "IX_Notes_DocumentId",
                table: "Notes",
                column: "DocumentId");

            migrationBuilder.CreateIndex(
                name: "IX_Notes_YouTubeVideoId",
                table: "Notes",
                column: "YouTubeVideoId");

            migrationBuilder.CreateIndex(
                name: "IX_OtpCodes_Email_Purpose",
                table: "OtpCodes",
                columns: new[] { "Email", "Purpose" });

            migrationBuilder.CreateIndex(
                name: "IX_OtpCodes_ExpiresAt",
                table: "OtpCodes",
                column: "ExpiresAt");

            migrationBuilder.CreateIndex(
                name: "IX_OtpCodes_UserId",
                table: "OtpCodes",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_QuizAttempts_UserId_AttemptedAt",
                table: "QuizAttempts",
                columns: new[] { "UserId", "AttemptedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_QuizSubmissions_DocumentId_UserId",
                table: "QuizSubmissions",
                columns: new[] { "DocumentId", "UserId" });

            migrationBuilder.CreateIndex(
                name: "IX_QuizSubmissions_YouTubeVideoId_UserId",
                table: "QuizSubmissions",
                columns: new[] { "YouTubeVideoId", "UserId" });

            migrationBuilder.CreateIndex(
                name: "IX_Quizzes_DocumentId",
                table: "Quizzes",
                column: "DocumentId");

            migrationBuilder.CreateIndex(
                name: "IX_Quizzes_YouTubeVideoId",
                table: "Quizzes",
                column: "YouTubeVideoId");

            migrationBuilder.CreateIndex(
                name: "IX_RefreshTokens_Token",
                table: "RefreshTokens",
                column: "Token",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RefreshTokens_UserId_IsRevoked_ExpiresAt",
                table: "RefreshTokens",
                columns: new[] { "UserId", "IsRevoked", "ExpiresAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Users_Email",
                table: "Users",
                column: "Email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_YouTubeVideos_CourseId",
                table: "YouTubeVideos",
                column: "CourseId");

            migrationBuilder.CreateIndex(
                name: "IX_YouTubeVideos_UserId",
                table: "YouTubeVideos",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ChatMessages");

            migrationBuilder.DropTable(
                name: "FlashcardReviews");

            migrationBuilder.DropTable(
                name: "Flashcards");

            migrationBuilder.DropTable(
                name: "Notes");

            migrationBuilder.DropTable(
                name: "OtpCodes");

            migrationBuilder.DropTable(
                name: "QuizAttempts");

            migrationBuilder.DropTable(
                name: "QuizSubmissions");

            migrationBuilder.DropTable(
                name: "Quizzes");

            migrationBuilder.DropTable(
                name: "RefreshTokens");

            migrationBuilder.DropTable(
                name: "Documents");

            migrationBuilder.DropTable(
                name: "YouTubeVideos");

            migrationBuilder.DropTable(
                name: "Courses");

            migrationBuilder.DropTable(
                name: "Users");
        }
    }
}
