using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace halla_measurement_1.Migrations
{
    public partial class InitialCreate : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ActionHistories",
                columns: table => new
                {
                    ActionHistoryId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TableName = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ColumnName = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    RecordId = table.Column<int>(type: "int", nullable: false),
                    ModifiedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    OldValue = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    NewValue = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ActionType = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    UserName = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ActionHistories", x => x.ActionHistoryId);
                });

            migrationBuilder.CreateTable(
                name: "Equips",
                columns: table => new
                {
                    EquipId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    EquipName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Equips", x => x.EquipId);
                });

            migrationBuilder.CreateTable(
                name: "Models",
                columns: table => new
                {
                    ModelId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    PartNo = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    PartName = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Material = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ProductDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    WO = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Machine = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Models", x => x.ModelId);
                });

            migrationBuilder.CreateTable(
                name: "ModelImages",
                columns: table => new
                {
                    ImageId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    FileName = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Base64Data = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ContentType = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ModelId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ModelImages", x => x.ImageId);
                    table.ForeignKey(
                        name: "FK_ModelImages_Models_ModelId",
                        column: x => x.ModelId,
                        principalTable: "Models",
                        principalColumn: "ModelId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ModelSpecifications",
                columns: table => new
                {
                    SpecId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SpecName = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    EquipName = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    MinValue = table.Column<double>(type: "float", nullable: true),
                    MaxValue = table.Column<double>(type: "float", nullable: true),
                    Unit = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ModelId = table.Column<int>(type: "int", nullable: false)
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
                    ProductId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ModelId = table.Column<int>(type: "int", nullable: false),
                    MeasurementDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    MoldNumber = table.Column<string>(type: "nvarchar(max)", nullable: false)
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

            migrationBuilder.CreateTable(
                name: "Measurements",
                columns: table => new
                {
                    MeasurementId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ProductId = table.Column<int>(type: "int", nullable: false),
                    SpecId = table.Column<int>(type: "int", nullable: true),
                    MeasuredValue = table.Column<double>(type: "float", nullable: false),
                    MeasuredAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Measurements", x => x.MeasurementId);
                    table.ForeignKey(
                        name: "FK_Measurements_ModelSpecifications_SpecId",
                        column: x => x.SpecId,
                        principalTable: "ModelSpecifications",
                        principalColumn: "SpecId",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_Measurements_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Products",
                        principalColumn: "ProductId");
                });

            migrationBuilder.CreateIndex(
                name: "IX_Measurements_MeasuredAt",
                table: "Measurements",
                column: "MeasuredAt")
                .Annotation("SqlServer:Clustered", false);

            migrationBuilder.CreateIndex(
                name: "IX_Measurements_ProductId",
                table: "Measurements",
                column: "ProductId");

            migrationBuilder.CreateIndex(
                name: "IX_Measurements_SpecId",
                table: "Measurements",
                column: "SpecId");

            migrationBuilder.CreateIndex(
                name: "IX_ModelImages_ModelId",
                table: "ModelImages",
                column: "ModelId");

            migrationBuilder.CreateIndex(
                name: "IX_Models_PartNo",
                table: "Models",
                column: "PartNo",
                unique: true)
                .Annotation("SqlServer:Clustered", false);

            migrationBuilder.CreateIndex(
                name: "IX_ModelSpecifications_ModelId",
                table: "ModelSpecifications",
                column: "ModelId");

            migrationBuilder.CreateIndex(
                name: "IX_Products_MeasurementDate",
                table: "Products",
                column: "MeasurementDate")
                .Annotation("SqlServer:Clustered", false);

            migrationBuilder.CreateIndex(
                name: "IX_Products_ModelId",
                table: "Products",
                column: "ModelId");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ActionHistories");

            migrationBuilder.DropTable(
                name: "Equips");

            migrationBuilder.DropTable(
                name: "Measurements");

            migrationBuilder.DropTable(
                name: "ModelImages");

            migrationBuilder.DropTable(
                name: "ModelSpecifications");

            migrationBuilder.DropTable(
                name: "Products");

            migrationBuilder.DropTable(
                name: "Models");
        }
    }
}
