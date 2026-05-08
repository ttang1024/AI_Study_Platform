using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using StudyPlatform.Infrastructure.Data;

#nullable disable

namespace StudyPlatform.Infrastructure.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260508000000_AddDifficultyToQuizzes")]
public partial class AddDifficultyToQuizzes : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            ALTER TABLE "Quizzes"
            ADD COLUMN IF NOT EXISTS "Difficulty" character varying(20) NOT NULL DEFAULT 'medium';
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "Difficulty",
            table: "Quizzes");
    }
}
