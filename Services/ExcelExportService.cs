// ExcelExportService.cs
using ClosedXML.Excel;
using Models;
using Microsoft.Extensions.Logging;
using Microsoft.AspNetCore.Hosting;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using DocumentFormat.OpenXml.Presentation;
using System.Text.Json;

namespace Services
{
    public class ExcelExportService
    {
        private readonly string _templatePath;
        private readonly ILogger<ExcelExportService> _logger;
        private readonly IWebHostEnvironment _webHostEnvironment;

        // Define cell addresses as constants for better maintenance
        private static class DimenstionDC
        {
            public const string TITLE = "A1";  // "Measurement Report"
            public const string CUSTOMER = "C3";
            public const string PART_NAME = "F3";
            public const string PART_NO = "F4";
            public const string MATERIAL = "C4";
            public const string INSPECTOR_A = "K2";
            public const string INSPECTOR_B = "M2";
            public const string CHECKED = "O2";
            public const string APPROVED = "Q2";
            public const string DATE = "A5"; // Include text before cell value
            // Data starts from row 8
            public const string WO = "A6"; // Include text before cell value
            public const string PROCESS = "A7"; // Process (công đoạn)
            public const string MACHINE = "A8"; // Machine (máy)
            public const string MOLD = "I8"; // Mold (khuôn)

            // TABLE DATA START FROM ROW 12
            public const int DATA_START_ROW = 12;
        }

        public ExcelExportService(
            ILogger<ExcelExportService> logger,
            IWebHostEnvironment webHostEnvironment)
        {
            _logger = logger;
            _webHostEnvironment = webHostEnvironment;
            _templatePath = Path.Combine(_webHostEnvironment.WebRootPath, "templates", "excel");
            Directory.CreateDirectory(_templatePath);
        }

        public async Task<string> ExportMeasurementsToExcel(SpecificationData data, List<Product> products)
        {
            try
            {
                var templatePath = Path.Combine(_templatePath, "measurement_template.xlsx");
                if (!File.Exists(templatePath))
                {
                    throw new FileNotFoundException("Template file not found", templatePath);
                }

                using var workbook = new XLWorkbook(templatePath);
                var worksheet = workbook.Worksheet(1);

                // Fill header information
                FillHeaderInformation(worksheet, data);
                FillSpecificationData(worksheet, data ?? new SpecificationData());

                // Fill measurement data
                FillMeasurementData(worksheet, products);

                // Save to temp file
                var outputFileName = $"measurement_report_{DateTime.Now:yyyyMMddHHmmss}.xlsx";
                var outputPath = Path.Combine(_templatePath, "output", outputFileName);

                // Create directory if it doesn't exist
                Directory.CreateDirectory(Path.GetDirectoryName(outputPath) ?? "");

                workbook.SaveAs(outputPath);
                _logger.LogInformation("Excel file exported to {outputPath}", outputPath);

                return outputFileName;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error exporting to Excel");
                throw;
            }
        }

        private void FillHeaderInformation(IXLWorksheet worksheet, SpecificationData data)
        {
            // Fill basic information using your DimenstionDC constants
            worksheet.Cell(DimenstionDC.CUSTOMER).Value = data.Customer;
            worksheet.Cell(DimenstionDC.PART_NAME).Value = data.PartName;
            worksheet.Cell(DimenstionDC.PART_NO).Value = data.PartNo;
            worksheet.Cell(DimenstionDC.MATERIAL).Value = data.Material;

            // Add text before date value
            worksheet.Cell(DimenstionDC.DATE).Value =
                $"Date production (ngày sản xuất): {data.ProductionDate:yyyy-MM-dd}";

            worksheet.Cell(DimenstionDC.WO).Value =
                $"WO (mã số sản xuất): {data.WorkOrder}";

            // Fill inspector information
            worksheet.Cell(DimenstionDC.INSPECTOR_A).Value = data.InspectorA;
            worksheet.Cell(DimenstionDC.INSPECTOR_B).Value = data.InspectorB;
            worksheet.Cell(DimenstionDC.CHECKED).Value = data.CheckedBy;
            worksheet.Cell(DimenstionDC.APPROVED).Value = data.ApprovedBy;

            // Fill machine and mold info
            worksheet.Cell(DimenstionDC.MACHINE).Value = $"Machine (máy): {data.MachineName}";
            worksheet.Cell(DimenstionDC.PROCESS).Value = $"Process (quy trình): {data.Process}";
            worksheet.Cell(DimenstionDC.MOLD).Value = $"Mold (khuôn): {data.MoldNumber}";
        }

        private void FillSpecificationData(IXLWorksheet worksheet, SpecificationData data)
        {
            int currentRow = DimenstionDC.DATA_START_ROW; // Starts at row 12

            // First, fill the specification details (columns A-E)
            for (int i = 0; i < data.Measurements.Count; i++)
            {
                var measurement = data.Measurements[i];

                // Fill specification columns
                worksheet.Cell($"A{currentRow + i}").Value = i + 1;  // No.
                worksheet.Cell($"B{currentRow + i}").Value = measurement.DimensionCode;  // SpecName
                // Column C is left blank
                worksheet.Cell($"D{currentRow + i}").Value = $"{measurement.MinValue} - {measurement.MaxValue}";  // Min-Max
                worksheet.Cell($"E{currentRow + i}").Value = measurement.EquipName;  // Equipment

                // Apply formatting
                worksheet.Range($"A{currentRow + i}:E{currentRow + i}").Style
                    .Border.SetOutsideBorder(XLBorderStyleValues.Thin)
                    .Font.SetFontSize(18);
            }
        }

        private void FillMeasurementData(IXLWorksheet worksheet, List<Product> products)
        {
            try
            {
                const int START_ROW = 12;  // Starting row for data
                // START column: G
                const int START_COLUMN = 7;
                const int HEADER_ROW = 11; // Row for headers

                // Get specifications from the first product's model
                var specs = products
                    .FirstOrDefault()
                    ?.Model
                    ?.Specifications
                    ?.OrderBy(s => s.SpecName)
                    .ToList() ?? new List<ModelSpecification>();

                // _logger.LogInformation("Processing measurements for {count} products with {specCount} specifications",
                //     products.Count, specs.Count);

                // // Write headers
                // worksheet.Cell($"A{HEADER_ROW}").Value = "STT";
                // worksheet.Cell($"B{HEADER_ROW}").Value = "Mold Number";
                // worksheet.Cell($"C{HEADER_ROW}").Value = "Time";

                // // Write specification headers
                // for (int i = 0; i < specs.Count; i++)
                // {
                //     var spec = specs[i];
                //     worksheet.Cell(HEADER_ROW, i + 4).Value = $"{spec.SpecName} ({spec.Unit})"; // +4 because we start after STT, Mold, Time
                // }

                // // Style headers
                // var headerRange = worksheet.Range(HEADER_ROW, 1, HEADER_ROW, specs.Count + 3);
                // headerRange.Style
                //     .Font.SetBold(true)
                //     .Font.SetFontSize(12)
                //     .Alignment.SetHorizontal(XLAlignmentHorizontalValues.Center)
                //     .Border.SetOutsideBorder(XLBorderStyleValues.Thin);

                // Fill data rows
                if (products.Any())
                {
                    for (int productIndex = 0; productIndex < products.Count; productIndex++) 
                    {
                        _logger.LogInformation("Processing product {productIndex}", productIndex);
                        _logger.LogInformation("Processing product time {productTime}", products[productIndex].MeasurementDate.ToLocalTime());
                        var product = products[productIndex];
                        
                        // Calculate column with 2x spacing to account for merged cells
                        int currentColumn = START_COLUMN + (productIndex * 2);

                        // Write product header (mold number and date)
                        // worksheet.Cell(HEADER_ROW, currentColumn).Value = $"{product.MeasurementDate.ToLocalTime():yyyy-MM-dd HH:mm:ss}";

                        for (int specIndex = 0; specIndex < specs.Count; specIndex++)
                        {
                            var spec = specs[specIndex];
                            int currentRow = START_ROW + specIndex;

                            var measurement = product.Measurements?
                                .FirstOrDefault(m => m.SpecId == spec.SpecId);

                            var cell = worksheet.Cell(currentRow, currentColumn);

                            if (measurement != null)
                            {
                                cell.Value = Math.Round(measurement.MeasuredValue, 2);

                                bool isWithinRange = measurement.MeasuredValue >= spec.MinValue && 
                                    measurement.MeasuredValue <= spec.MaxValue;

                                // cell.Style
                                //     .Fill.SetBackgroundColor(isWithinRange ? 
                                //         XLColor.FromHtml("#BBF7D0") : XLColor.FromHtml("#FECACA"))
                                //     .Font.SetFontColor(isWithinRange ? 
                                //         XLColor.FromHtml("#14532D") : XLColor.FromHtml("#7F1D1D"));
                            }
                            else
                            {
                                cell.Value = "--";
                            }
                        }
                    }
                    // for (int rowIndex = 0; rowIndex < products.Count; rowIndex++)
                    // {
                    //     var product = products[rowIndex];
                    //     int currentRow = START_ROW + rowIndex;

                    //     // Fill basic product info
                    //     // worksheet.Cell(currentRow, 1).Value = rowIndex + 1; // STT
                    //     // worksheet.Cell(currentRow, 2).Value = product.MoldNumber ?? "--";
                    //     // worksheet.Cell(currentRow, 3).Value = product.MeasurementDate.ToLocalTime().ToString("g");

                    //     // Fill measurements
                    //     for (int specIndex = 0; specIndex < specs.Count; specIndex++)
                    //     {
                    //         var spec = specs[specIndex];
                    //         var measurement = product.Measurements?
                    //             .FirstOrDefault(m => m.SpecId == spec.SpecId);

                    //         var cell = worksheet.Cell(currentRow, specIndex + 4); // +4 because we start after STT, Mold, Time

                    //         if (measurement != null)
                    //         {
                    //             cell.Value = Math.Round(measurement.MeasuredValue, 2);

                    //             // Apply conditional formatting (like in-range/out-of-range in the table)
                    //             bool isWithinRange = measurement.MeasuredValue >= spec.MinValue && 
                    //                 measurement.MeasuredValue <= spec.MaxValue;

                    //             cell.Style
                    //                 .Fill.SetBackgroundColor(isWithinRange ? 
                    //                     XLColor.FromHtml("#BBF7D0") : XLColor.FromHtml("#FECACA"))
                    //                 .Font.SetFontColor(isWithinRange ? 
                    //                     XLColor.FromHtml("#14532D") : XLColor.FromHtml("#7F1D1D"));
                    //         }
                    //         else
                    //         {
                    //             cell.Value = "--";
                    //         }
                    //     }

                    //     // Style the entire row
                    //     worksheet.Range(currentRow, 1, currentRow, specs.Count + 3).Style
                    //         .Border.SetOutsideBorder(XLBorderStyleValues.Thin)
                    //         .Font.SetFontSize(18)
                    //         .Alignment.SetHorizontal(XLAlignmentHorizontalValues.Center);
                    // }
                }
                else
                {
                    // If no products, add a "No data" message
                    // worksheet.Range(START_ROW, 1, START_ROW, specs.Count + 3).Merge();
                    // worksheet.Cell(START_ROW, 1).Value = "No measurement data available for this model";
                    // worksheet.Cell(START_ROW, 1).Style
                    //     .Alignment.SetHorizontal(XLAlignmentHorizontalValues.Center)
                    //     .Font.SetItalic(true)
                    //     .Font.SetFontColor(XLColor.Gray);
                }

                // Auto-fit columns
                // worksheet.Columns().AdjustToContents();

                _logger.LogInformation("Successfully filled measurement data table");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error filling measurement data");
                throw;
            }
        }

        private string GetExcelColumnName(int columnNumber)
        {
            string columnName = "";
            while (columnNumber >= 0)
            {
                int remainder = columnNumber % 26;
                columnName = Convert.ToChar(65 + remainder) + columnName;
                columnNumber = (columnNumber / 26) - 1;
            }
            return columnName;
        }
    }

    // Data transfer objects for the measurements
    public class SpecificationData
    {
        public string? Customer { get; set; }
        public string? PartName { get; set; }
        public string? PartNo { get; set; }
        public string? Material { get; set; }
        public DateTime ProductionDate { get; set; }
        public string? WorkOrder { get; set; }
        public string? Process { get; set; }
        public string? MachineName { get; set; }
        public string? InspectorA { get; set; }
        public string? InspectorB { get; set; }
        public string? CheckedBy { get; set; }
        public string? ApprovedBy { get; set; }
        public string? MoldNumber { get; set; }
        public List<MeasurementData>? Measurements { get; set; }
    }

    public class MeasurementData
    {
        public string? DimensionCode { get; set; }
        public double MinValue { get; set; }
        public double MaxValue { get; set; }
        public string? EquipName { get; set; }
        public List<MoldValue>? MoldValues { get; set; }
    }

    public class MoldValue
    {
        public string MoldNumber { get; set; } = string.Empty;
        public double Value { get; set; }
    }

    
}
