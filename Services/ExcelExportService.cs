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
        private readonly string _fallbackTemplatePath;
        private readonly ILogger<ExcelExportService> _logger;
        private readonly IWebHostEnvironment _webHostEnvironment;
        private bool _isFallbackTemplate = false;

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
            _fallbackTemplatePath = Path.Combine(_webHostEnvironment.WebRootPath, "templates", "excel");
            // @"wwwroot\templates\excel\models"
            _templatePath = Path.Combine(_webHostEnvironment.WebRootPath, "templates", "excel", "models");
            Directory.CreateDirectory(_fallbackTemplatePath);
            if (!Directory.Exists(_templatePath))
            {
                Directory.CreateDirectory(_templatePath);
            }
        }
        
        private string ExtractPartNo(string fileName)
        {
            // Implement your logic to extract part numbers from file names
            var match = System.Text.RegularExpressions.Regex.Match(fileName, @"[A-Z]{2,}\d{5,}");
            return match.Success ? match.Value : string.Empty;
        }

        public async Task<string> ExportMeasurementsToExcel(SpecificationData data, List<Product> products, string processName = "LQC")
        {
            try
            {
                _logger.LogInformation("Exporting measurements to Excel... process name: {processName}", processName);
                var fallbackTemplatePath = Path.Combine(_fallbackTemplatePath, "measurement_template.xlsx");
                var templatePath = "";

                // Supported Excel file extensions
                var supportedExtensions = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
                {
                    ".xlsx",
                    ".xls",
                    ".xlsm", // Macro-enabled workbook
                    ".xltx", // Excel template
                    ".xltm"  // Macro-enabled template
                };

                var regex = new System.Text.RegularExpressions.Regex(@"[A-Z]{2,5}\d{5,}", System.Text.RegularExpressions.RegexOptions.IgnoreCase);

                // search for template in _templatePath
                var templateFiles = Directory.GetFiles(_templatePath, "*.*", SearchOption.AllDirectories)
                    .Where(file =>
                    {
                        var extension = Path.GetExtension(file); // Get the file extension
                        return supportedExtensions.Contains(extension) && regex.IsMatch(Path.GetFileName(file)) && Path.GetFileName(file).Contains(processName, StringComparison.OrdinalIgnoreCase);
                    })
                    .Select(file => new FileInfoDto
                    {
                        FileName = Path.GetFileName(file),
                        PartNo = ExtractPartNo(Path.GetFileName(file)),
                        FullPath = file
                    })
                    .ToList();
                // var templateFiles = Directory.GetFiles(_templatePath, data.PartNo + ".xlsx");
                if (templateFiles.Count > 0)
                {
                    templatePath = templateFiles[0].FullPath;
                }

                if (templatePath == "")
                {
                    templatePath = fallbackTemplatePath;
                    _isFallbackTemplate = true;
                }

                if (!File.Exists(templatePath))
                {
                    throw new FileNotFoundException("Template file not found", templatePath);
                }

                using var workbook = new XLWorkbook(templatePath);
                
                // Get both worksheets
                var dcWorksheet = workbook.Worksheets
                    .FirstOrDefault(ws => ws.Name.Contains("Dimension DC", StringComparison.OrdinalIgnoreCase));
                var cncWorksheet = workbook.Worksheets
                    .FirstOrDefault(ws => ws.Name.Contains("Dimension CNC", StringComparison.OrdinalIgnoreCase));

                if (dcWorksheet == null)
                {
                    dcWorksheet = workbook.Worksheets
                        .FirstOrDefault(ws => ws.Name.Contains("2.Dimension DC", StringComparison.OrdinalIgnoreCase));
                }

                if (cncWorksheet == null)
                {
                    cncWorksheet = workbook.Worksheets
                        .FirstOrDefault(ws => ws.Name.Contains("4.Dimension CNC", StringComparison.OrdinalIgnoreCase));
                }

                if (dcWorksheet == null)
                {
                    _logger.LogError("Không tìm thấy sheet 'Dimension DC' trong file template, fallback to fallback template");
                    templatePath = fallbackTemplatePath;
                    dcWorksheet = new XLWorkbook(templatePath).Worksheets
                        .FirstOrDefault(ws => ws.Name.Contains("Dimension DC", StringComparison.OrdinalIgnoreCase));
                    cncWorksheet = new XLWorkbook(templatePath).Worksheets
                        .FirstOrDefault(ws => ws.Name.Contains("Dimension CNC", StringComparison.OrdinalIgnoreCase));
                    _isFallbackTemplate = true;
                }

                // Filter specifications by process
                var dcSpecs = data.Measurements.Where(m => m.ProcessName == "LQC").ToList();
                var cncSpecs = data.Measurements.Where(m => m.ProcessName == "CNC").ToList();

                // Fill header information for both sheets
                if (_isFallbackTemplate)
                {
                    FillHeaderInformation(dcWorksheet, data);
                    FillHeaderInformation(cncWorksheet, data);
                    // Fill specification data for each process
                    FillSpecificationData(dcWorksheet, new SpecificationData 
                    { 
                        Customer = data.Customer,
                        PartName = data.PartName,
                        PartNo = data.PartNo,
                        Material = data.Material,
                        ProductionDate = data.ProductionDate,
                        WorkOrder = data.WorkOrder,
                        Process = data.Process,
                        MachineName = data.MachineName,
                        InspectorA = data.InspectorA,
                        InspectorB = data.InspectorB,
                        CheckedBy = data.CheckedBy,
                        ApprovedBy = data.ApprovedBy,
                        MoldNumber = data.MoldNumber,
                        Measurements = dcSpecs
                    });
                    FillSpecificationData(cncWorksheet, new SpecificationData
                    { 
                        Customer = data.Customer,
                        PartName = data.PartName,
                        PartNo = data.PartNo,
                        Material = data.Material,
                        ProductionDate = data.ProductionDate,
                        WorkOrder = data.WorkOrder,
                        Process = data.Process,
                        MachineName = data.MachineName,
                        InspectorA = data.InspectorA,
                        InspectorB = data.InspectorB,
                        CheckedBy = data.CheckedBy,
                        ApprovedBy = data.ApprovedBy,
                        MoldNumber = data.MoldNumber,
                        Measurements = cncSpecs
                    }, 10);
                }

                if (_isFallbackTemplate)
                {
                    // Fill measurement data for each process
                    FillMeasurementData(dcWorksheet, products, "LQC");
                    // FillMeasurementData(cncWorksheet, products, "CNC");
                } else {
                    FillMeasurementDataWithTracking(dcWorksheet, products, "LQC");
                    // FillMeasurementDataWithTracking(cncWorksheet, products, "CNC");
                }

                // Save to temp file
                var outputFileName = $"measurement_report_{DateTime.Now:yyyyMMddHHmmss}.xlsx";
                var outputPath = Path.Combine(_fallbackTemplatePath, "output", outputFileName);

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

        private void FillSpecificationData(IXLWorksheet worksheet, SpecificationData data, int fontSize = 18)
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
                worksheet.Range($"A{currentRow + i}:E{currentRow + i + 1}").Style
                    .Border.SetOutsideBorder(XLBorderStyleValues.Thin)
                    .Font.SetFontSize(fontSize);
            }

            // set font size of cells from G12 to I37 to 18 
            worksheet.Range($"G{DimenstionDC.DATA_START_ROW}:I{DimenstionDC.DATA_START_ROW + data.Measurements.Count}").Style
                .Font.SetFontSize(18);
        }

        private void FillMeasurementData(IXLWorksheet worksheet, List<Product> products, string processName)
        {
            try
            {
                const int START_ROW = 12;
                const int START_COLUMN = 7;

                // Get specifications for the current process only
                var specs = products
                    .FirstOrDefault()
                    ?.Model
                    ?.Specifications
                    ?.Where(s => s.ProcessName == processName)
                    ?.OrderBy(s => s.SpecName)
                    .ToList() ?? new List<ModelSpecification>();

                if (products.Any())
                {
                    for (int productIndex = 0; productIndex < products.Count; productIndex++) 
                    {
                        _logger.LogInformation("Processing product {productIndex} for process {processName}", 
                            productIndex, processName);
                        
                        var product = products[productIndex];
                        int currentColumn = START_COLUMN + (productIndex * 2);

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
                            }
                            else
                            {
                                cell.Value = "--";
                            }
                        }
                    }
                }

                _logger.LogInformation("Successfully filled measurement data for process {processName}", 
                    processName);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error filling measurement data for process {processName}", processName);
                throw;
            }
        }
        private void FillMeasurementDataWithTracking(IXLWorksheet worksheet, List<Product> products, string processName)
        {
            try
            {
                // find the cell with text: 'No1' or 'No 1' and get the row number
                // var no1Cell = worksheet.CellsUsed().FirstOrDefault(c => c.Value.ToString() == "No1" || c.Value.ToString() == "No 1");
                // int START_ROW = no1Cell?.Address.RowNumber + 1 ?? 12;
                int START_ROW = 12;
                int START_COLUMN = 7;

                // Get specifications for the current process only
                var specs = products
                    .FirstOrDefault()
                    ?.Model
                    ?.Specifications
                    ?.Where(s => s.ProcessName == processName)
                    ?.OrderBy(s => s.SpecName)
                    .ToList() ?? new List<ModelSpecification>();

                if (products.Any())
                {
                    for (int productIndex = 0; productIndex < products.Count; productIndex++) 
                    {
                        _logger.LogInformation("Processing product {productIndex} for process {processName}", 
                            productIndex, processName);
                        
                        var product = products[productIndex];
                        int currentColumn = START_COLUMN + (productIndex * 2);

                        for (int specIndex = 0; specIndex < specs.Count; specIndex++)
                        {
                            _logger.LogInformation("Processing spec {specIndex} for product {productIndex} for process {processName}", specIndex, productIndex, processName);
                            var spec = specs[specIndex];
                            int currentRow = START_ROW + specIndex;

                            var measurement = product.Measurements?
                                .FirstOrDefault(m => m.SpecId == spec.SpecId);

                            var cell = worksheet.Cell(currentRow, currentColumn);

                            if (measurement != null)
                            {
                                cell.Value = Math.Round(measurement.MeasuredValue, 2);
                            }
                            else
                            {
                                cell.Value = "--";
                            }
                        }
                    }
                }

                _logger.LogInformation("Successfully filled measurement data for process {processName}", 
                    processName);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error filling measurement data for process {processName}", processName);
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
        public string ProcessName { get; set; } = string.Empty;
    }

    public class MoldValue
    {
        public string MoldNumber { get; set; } = string.Empty;
        public double Value { get; set; }
    }

    
}
