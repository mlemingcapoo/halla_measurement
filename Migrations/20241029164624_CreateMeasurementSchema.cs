using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace halla_measurement_1.Migrations
{
    public partial class CreateMeasurementSchema : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropPrimaryKey(
                name: "PK_Measurements",
                table: "Measurements");

            migrationBuilder.RenameColumn(
                name: "Timestamp",
                table: "Measurements",
                newName: "MeasuredAt");

            migrationBuilder.RenameColumn(
                name: "Id",
                table: "Measurements",
                newName: "SpecificationSpecId");

            migrationBuilder.RenameIndex(
                name: "IX_Measurements_Timestamp",
                table: "Measurements",
                newName: "IX_Measurements_MeasuredAt");

            migrationBuilder.AlterColumn<int>(
                name: "SpecificationSpecId",
                table: "Measurements",
                type: "INTEGER",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "INTEGER")
                .OldAnnotation("Sqlite:Autoincrement", true);

            migrationBuilder.AddColumn<int>(
                name: "MeasurementId",
                table: "Measurements",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0)
                .Annotation("Sqlite:Autoincrement", true);

            migrationBuilder.AddColumn<bool>(
                name: "IsWithinSpec",
                table: "Measurements",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<double>(
                name: "MeasuredValue",
                table: "Measurements",
                type: "REAL",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<int>(
                name: "ProductId",
                table: "Measurements",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "SpecId",
                table: "Measurements",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddPrimaryKey(
                name: "PK_Measurements",
                table: "Measurements",
                column: "MeasurementId");

            migrationBuilder.CreateTable(
                name: "Models",
                columns: table => new
                {
                    ModelId = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    ModelCode = table.Column<string>(type: "TEXT", nullable: false),
                    ModelName = table.Column<string>(type: "TEXT", nullable: false),
                    Description = table.Column<string>(type: "TEXT", nullable: true),
                    ImagePath = table.Column<string>(type: "TEXT", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    TotalProducts = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Models", x => x.ModelId);
                });

            migrationBuilder.CreateTable(
                name: "ModelSpecifications",
                columns: table => new
                {
                    SpecId = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    ModelId = table.Column<int>(type: "INTEGER", nullable: false),
                    SpecName = table.Column<string>(type: "TEXT", nullable: false),
                    MinValue = table.Column<double>(type: "REAL", nullable: false),
                    MaxValue = table.Column<double>(type: "REAL", nullable: false),
                    Unit = table.Column<string>(type: "TEXT", nullable: true),
                    DisplayOrder = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ModelSpecifications", x => x.SpecId);
                    table.ForeignKey(
                        name: "FK_ModelSpecifications_Models_ModelId",
                        column: x => x.ModelId,
                        principalTable: "Models",
                        principalColumn: "ModelId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Products",
                columns: table => new
                {
                    ProductId = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    ModelId = table.Column<int>(type: "INTEGER", nullable: false),
                    MeasurementDate = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Status = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Products", x => x.ProductId);
                    table.ForeignKey(
                        name: "FK_Products_Models_ModelId",
                        column: x => x.ModelId,
                        principalTable: "Models",
                        principalColumn: "ModelId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Measurements_ProductId",
                table: "Measurements",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_Measurements_SpecificationSpecId",
                table: "Measurements",
                column: "SpecificationSpecId");

            migrationBuilder.CreateIndex(
                name: "IX_Models_ModelCode",
                table: "Models",
                column: "ModelCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ModelSpecifications_ModelId",
                table: "ModelSpecifications",
                column: "ModelId");

            migrationBuilder.CreateIndex(
                name: "IX_Products_MeasurementDate",
                table: "Products",
                column: "MeasurementDate");

            migrationBuilder.CreateIndex(
                name: "IX_Products_ModelId",
                table: "Products",
                column: "ModelId");

            migrationBuilder.AddForeignKey(
                name: "FK_Measurements_ModelSpecifications_SpecificationSpecId",
                table: "Measurements",
                column: "SpecificationSpecId",
                principalTable: "ModelSpecifications",
                principalColumn: "SpecId",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Measurements_Products_ProductId",
                table: "Measurements",
                column: "ProductId",
                principalTable: "Products",
                principalColumn: "ProductId",
                onDelete: ReferentialAction.Cascade);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Measurements_ModelSpecifications_SpecificationSpecId",
                table: "Measurements");

            migrationBuilder.DropForeignKey(
                name: "FK_Measurements_Products_ProductId",
                table: "Measurements");

            migrationBuilder.DropTable(
                name: "ModelSpecifications");

            migrationBuilder.DropTable(
                name: "Products");

            migrationBuilder.DropTable(
                name: "Models");

            migrationBuilder.DropPrimaryKey(
                name: "PK_Measurements",
                table: "Measurements");

            migrationBuilder.DropIndex(
                name: "IX_Measurements_ProductId",
                table: "Measurements");

            migrationBuilder.DropIndex(
                name: "IX_Measurements_SpecificationSpecId",
                table: "Measurements");

            migrationBuilder.DropColumn(
                name: "MeasurementId",
                table: "Measurements");

            migrationBuilder.DropColumn(
                name: "IsWithinSpec",
                table: "Measurements");

            migrationBuilder.DropColumn(
                name: "MeasuredValue",
                table: "Measurements");

            migrationBuilder.DropColumn(
                name: "ProductId",
                table: "Measurements");

            migrationBuilder.DropColumn(
                name: "SpecId",
                table: "Measurements");

            migrationBuilder.RenameColumn(
                name: "SpecificationSpecId",
                table: "Measurements",
                newName: "Id");

            migrationBuilder.RenameColumn(
                name: "MeasuredAt",
                table: "Measurements",
                newName: "Timestamp");

            migrationBuilder.RenameIndex(
                name: "IX_Measurements_MeasuredAt",
                table: "Measurements",
                newName: "IX_Measurements_Timestamp");

            migrationBuilder.AlterColumn<int>(
                name: "Id",
                table: "Measurements",
                type: "INTEGER",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "INTEGER")
                .Annotation("Sqlite:Autoincrement", true);

            migrationBuilder.AddPrimaryKey(
                name: "PK_Measurements",
                table: "Measurements",
                column: "Id");
        }
    }
}
