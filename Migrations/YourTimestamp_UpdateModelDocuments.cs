using Microsoft.EntityFrameworkCore.Migrations;

namespace YourNamespace.Migrations
{
    public partial class UpdateModelDocuments : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // First drop existing foreign key if it exists
            migrationBuilder.DropForeignKey(
                name: "FK_ModelDocuments_Models_ModelId",
                table: "ModelDocuments");

            // Modify columns if needed
            migrationBuilder.AlterColumn<string>(
                name: "FileName",
                table: "ModelDocuments",
                type: "nvarchar(255)",
                maxLength: 255,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            // Add back the foreign key
            migrationBuilder.AddForeignKey(
                name: "FK_ModelDocuments_Models_ModelId",
                table: "ModelDocuments",
                column: "ModelId",
                principalTable: "Models",
                principalColumn: "ModelId",
                onDelete: ReferentialAction.Cascade);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Reverse the changes
        }
    }
} 