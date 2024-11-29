using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace halla_measurement_1.Migrations
{
    public partial class UpdateActionHistoryWithUserId : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "UserName",
                table: "ActionHistories");

            migrationBuilder.AddColumn<int>(
                name: "UserId",
                table: "ActionHistories",
                type: "int",
                nullable: true);

            migrationBuilder.UpdateData(
                table: "Users",
                keyColumn: "UserId",
                keyValue: 1,
                column: "CreatedAt",
                value: new DateTime(2024, 11, 28, 11, 4, 29, 957, DateTimeKind.Utc).AddTicks(9640));

            migrationBuilder.CreateIndex(
                name: "IX_ActionHistories_UserId",
                table: "ActionHistories",
                column: "UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_ActionHistories_Users_UserId",
                table: "ActionHistories",
                column: "UserId",
                principalTable: "Users",
                principalColumn: "UserId");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ActionHistories_Users_UserId",
                table: "ActionHistories");

            migrationBuilder.DropIndex(
                name: "IX_ActionHistories_UserId",
                table: "ActionHistories");

            migrationBuilder.DropColumn(
                name: "UserId",
                table: "ActionHistories");

            migrationBuilder.AddColumn<string>(
                name: "UserName",
                table: "ActionHistories",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.UpdateData(
                table: "Users",
                keyColumn: "UserId",
                keyValue: 1,
                column: "CreatedAt",
                value: new DateTime(2024, 11, 28, 10, 5, 43, 1, DateTimeKind.Utc).AddTicks(3053));
        }
    }
}
