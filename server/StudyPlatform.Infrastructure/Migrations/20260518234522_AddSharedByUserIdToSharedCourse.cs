using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StudyPlatform.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSharedByUserIdToSharedCourse : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Add nullable first so existing rows don't violate the FK
            migrationBuilder.AddColumn<Guid>(
                name: "SharedByUserId",
                table: "StudyGroupSharedCourses",
                type: "uuid",
                nullable: true);

            // Backfill existing rows with the group owner's ID
            migrationBuilder.Sql(@"
                UPDATE ""StudyGroupSharedCourses"" sc
                SET ""SharedByUserId"" = g.""OwnerId""
                FROM ""StudyGroups"" g
                WHERE sc.""GroupId"" = g.""StudyGroupId""
            ");

            // Now safe to make non-nullable
            migrationBuilder.AlterColumn<Guid>(
                name: "SharedByUserId",
                table: "StudyGroupSharedCourses",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_StudyGroupSharedCourses_SharedByUserId",
                table: "StudyGroupSharedCourses",
                column: "SharedByUserId");

            migrationBuilder.AddForeignKey(
                name: "FK_StudyGroupSharedCourses_Users_SharedByUserId",
                table: "StudyGroupSharedCourses",
                column: "SharedByUserId",
                principalTable: "Users",
                principalColumn: "UserId",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_StudyGroupSharedCourses_Users_SharedByUserId",
                table: "StudyGroupSharedCourses");

            migrationBuilder.DropIndex(
                name: "IX_StudyGroupSharedCourses_SharedByUserId",
                table: "StudyGroupSharedCourses");

            migrationBuilder.DropColumn(
                name: "SharedByUserId",
                table: "StudyGroupSharedCourses");
        }
    }
}
