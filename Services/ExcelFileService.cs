using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using ClosedXML.Excel;
using System.Drawing;
using System.Drawing.Imaging;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Spreadsheet;
using Models.Requests;
using DocumentFormat.OpenXml;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Processing;
using SixLabors.ImageSharp.Formats.Jpeg;

public class ExcelFileService
{
    private static List<FileInfoDto> _fileList = new();
    public event EventHandler<string>? ExcelFileError;
    public event EventHandler<string>? ExcelFileSuccess;

    private readonly ILogger<ExcelFileService> _logger;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ApplicationDbContext _context;

    public ExcelFileService(ILogger<ExcelFileService> logger, IServiceScopeFactory scopeFactory)
    {
        _logger = logger;
        _scopeFactory = scopeFactory;
        var scope = _scopeFactory.CreateScope();
        _context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    }

    public void BulkImport(FileInfoDto[] files)
    {
        if (files == null || files.Length == 0)
        {
            _logger.LogInformation("No files to import");
            return;
        }
        // remove the NOT IN LIST
        var _selectedList = new List<FileInfoDto>();
        for (int i = 0; i < files.Length; i++)
        {
            var file = files[i];
            // build a new list of files to import
            // add the files that matches the partNo
            if (_fileList.Any(f => f.PartNo == file.PartNo))
            {
                _selectedList.Add(_fileList.First(f => f.PartNo == file.PartNo));
            }
        }
        // overwrite the _fileList with the _selectedList
        _fileList = _selectedList;
        // _logger.LogInformation("Selected files: {SelectedFiles}", JsonSerializer.Serialize(_selectedList));
            // default save location to wwwroot\templates\excel\models
        // ImportData(@"wwwroot\templates\excel\models");
        if (ImportData(@"wwwroot\templates\excel\models"))
        {
            _logger.LogInformation("Import data successfully");
            ExcelFileSuccess?.Invoke(this, "Import data successfully");
        } else {
            ExcelFileError?.Invoke(this, "Có lỗi xảy ra khi import dữ liệu từ file Excel.");
        }
    }

    /// <summary>
    /// Scans a folder and its subdirectories for files matching specific regex criteria.
    /// </summary>
    /// <param name="folderPath">The folder to scan.</param>
    /// <param name="fileNameRegex">Regex to match file names.</param>
    /// <returns>List of FileInfoDto containing file name and part number.</returns>
    public List<FileInfoDto> ScanFolder(string folderPath, string fileNameRegex)
    {
        folderPath = folderPath.Trim('"');
        if (string.IsNullOrWhiteSpace(folderPath))
        {
            ExcelFileError?.Invoke(this, "Vui lòng chọn một folder chứa các file Excel để quét.");
            return new List<FileInfoDto>();
        }
        if (!Directory.Exists(folderPath))
        {
            ExcelFileError?.Invoke(this, $"Folder không tồn tại: {folderPath}");
            return new List<FileInfoDto>();
        }

        // Supported Excel file extensions
        var supportedExtensions = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            ".xlsx",
            ".xls",
            ".xlsm", // Macro-enabled workbook
            ".xltx", // Excel template
            ".xltm"  // Macro-enabled template
        };

        var regex = new System.Text.RegularExpressions.Regex(fileNameRegex, System.Text.RegularExpressions.RegexOptions.IgnoreCase);

        var files = Directory.GetFiles(folderPath, "*.*", SearchOption.AllDirectories)
            .Where(file =>
            {
                var extension = Path.GetExtension(file); // Get the file extension
                return supportedExtensions.Contains(extension) && regex.IsMatch(Path.GetFileName(file));
            })
            .Select(file => new FileInfoDto
            {
                FileName = Path.GetFileName(file),
                PartNo = ExtractPartNo(Path.GetFileName(file)),
                FullPath = file
            })
            .ToList();
        _logger.LogInformation("Saved scanned files results: {ScannedFiles}", JsonSerializer.Serialize(files));
        _fileList = files; // Store the scanned file list in memory for further operations
        return files;
    }


    /// <summary>
    /// Imports data from the scanned Excel files and processes the data into model objects.
    /// </summary>
    /// <param name="destinationFolder">The destination folder to copy files to.</param>
    /// <returns>True if the import is successful, false otherwise.</returns>
    public bool ImportData(string destinationFolder)
    {
        if (_fileList == null || !_fileList.Any())
        {
            ExcelFileError?.Invoke(this, "Chưa quét folder nào. Vui lòng chạy Scan trước khi import dữ liệu.");
            // throw new InvalidOperationException("No files have been scanned. Run ScanFolder before importing data.");
            _logger.LogInformation("Chưa quét folder nào. Vui lòng chạy Scan trước khi import dữ liệu.");
            return false;
        }

        if (string.IsNullOrWhiteSpace(destinationFolder))
        {
            ExcelFileError?.Invoke(this, "Folder đích không thể để trống.");
            _logger.LogInformation("Folder đích không thể để trống.");
            return false;
        }

        if (!Directory.Exists(destinationFolder))
        {
            ExcelFileError?.Invoke(this, $"Folder đích không tồn tại. Tạo folder: {destinationFolder}");
            _logger.LogInformation("Folder đích không tồn tại. Tạo folder: {DestinationFolder}", destinationFolder);
            Directory.CreateDirectory(destinationFolder);
        }

        var modelList = new List<FileInfoDto>();
            foreach (var file in _fileList)
            {
        try
        {
                _logger.LogInformation("Reading excel file: {FileName}", file.FileName);
                var sourcePath = file.FullPath; // Use the full path from the FileInfoDto
                _logger.LogInformation("FileName: {FileName}, FullPath: {SourcePath}", file.FileName, sourcePath);
                var destinationPath = Path.Combine(destinationFolder, file.FileName);

                File.Copy(sourcePath, destinationPath, overwrite: true);

                using (var workbook = new XLWorkbook(destinationPath))
                {
                    // Find the worksheet with a name that matches the desired pattern
                    var worksheet = workbook.Worksheets
                        .FirstOrDefault(ws => ws.Name.Contains("Dimension DC", StringComparison.OrdinalIgnoreCase));

                    if (worksheet == null)
                    {
                        _logger.LogInformation($"Không tìm thấy sheet 'Dimension DC' trong file {file.FileName}.");
                        ExcelFileError?.Invoke(this, $"Không tìm thấy sheet 'Dimension DC' trong file {file.FileName}. Đã bỏ qua file này.");
                        continue; // Exit the method or skip to the next file
                    }
                    _logger.LogInformation($"Tìm thấy sheet 'Dimension DC' trong file {file.FileName}.");
                    // Example: Get data from specific cells
                    var data = worksheet.Cell("A1").GetValue<string>(); // Example of cell address
                    var anotherData = worksheet.Cell("E1").GetValue<string>();
                    _logger.LogInformation("Data from A1: {Data}, Data from E1: {AnotherData}", data, anotherData);
                    if (GetDataAndInsertToDatabase(worksheet, file.FullPath))
                    {
                        ExcelFileSuccess?.Invoke(this, $"Import dữ liệu thành công cho model {file.PartNo}");
                    } else {
                        ExcelFileError?.Invoke(this, $"File bị lỗi: {file.PartNo}");
                    }
                }
        }
        catch (System.Exception ex)
        {
            _logger.LogError(ex, "Error importing data from Excel files.");
            ExcelFileError?.Invoke(this, $"File bị lỗi: {file.PartNo}");
            continue;
        }
            }

        // Save `modelList` to your database
        // SaveToDatabase(modelList);

        return true;
    }

    private (double? min, double? max, string unit) ParseMeasurement(string input)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(input))
                return (null, null, "mm");

            input = input.Replace(" ", "").ToLower();
            input = input.Replace(".", ",").ToLower();
            string measureUnit = "mm";

            var greaterThanMatch = System.Text.RegularExpressions.Regex.Match(input, @">(\d+\.?\d*)([a-zA-Z]+)?");
            if (greaterThanMatch.Success)
            {
                double minValue = double.Parse(greaterThanMatch.Groups[1].Value);
                measureUnit = greaterThanMatch.Groups[2].Success ? greaterThanMatch.Groups[2].Value : "mm";
                return (minValue, 99, measureUnit);
            }

            var lessThanMatch = System.Text.RegularExpressions.Regex.Match(input, @"<(\d+\.?\d*)([a-zA-Z]+)?");
            if (lessThanMatch.Success)
            {
                double maxValue = double.Parse(lessThanMatch.Groups[1].Value);
                measureUnit = lessThanMatch.Groups[2].Success ? lessThanMatch.Groups[2].Value : "mm";
                return (0, maxValue, measureUnit);
            }

            if (!input.Contains("~") && !input.Contains("-"))
            {
                return (null, null, "mm");
            }

            var unitMatch = System.Text.RegularExpressions.Regex.Match(input, "[a-zA-Z]+$");
            measureUnit = unitMatch.Success ? unitMatch.Value : "mm";

            var numericPart = input.Substring(0, input.Length - unitMatch.Length);

            var values = numericPart.Split(new[] { '~', '-' }, StringSplitOptions.RemoveEmptyEntries);
            
            if (values.Length != 2)
            {
                _logger.LogWarning($"Invalid measurement format: {input}");
                return (null, null, measureUnit);
            }

            if (double.TryParse(values[0], out double min) && double.TryParse(values[1], out double max))
            {
                return (min, max, measureUnit);
            }

            _logger.LogWarning($"Could not parse numeric values from: {input}");
            return (null, null, measureUnit);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error parsing measurement: {input}");
            return (null, null, "mm");
        }
    }

    private (double? min, double? max, string unit) ParseToleranceFormat(string input)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(input) || !input.Contains("±"))
                return (null, null, "mm");

            // Remove all whitespace and convert to lowercase for consistency
            input = input.Replace(" ", "").ToLower();

            // Match pattern: any numbers before ±, the tolerance value, and optional unit in parentheses
            var regex = new System.Text.RegularExpressions.Regex(@".*?(\d+\.?\d*)±(\d+\.?\d*)\s*\(?([a-zA-Z]+)?\)?");
            var match = regex.Match(input);

            if (!match.Success)
            {
                _logger.LogWarning($"Could not parse tolerance format: {input}");
                return (null, null, "mm");
            }

            // Extract base value, tolerance, and unit
            if (double.TryParse(match.Groups[1].Value, out double baseValue) && 
                double.TryParse(match.Groups[2].Value, out double tolerance))
            {
                var unit = match.Groups[3].Success ? match.Groups[3].Value : "mm";
                return (baseValue - tolerance, baseValue + tolerance, unit);
            }

            _logger.LogWarning($"Could not parse numeric values from: {input}");
            return (null, null, "mm");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error parsing tolerance format: {input}");
            return (null, null, "mm");
        }
    }

    // Usage examples:
    /*
    var result1 = ParseToleranceFormat("Cân nặng 3390±40 (g)");     // returns (3350, 3430, "g")
    var result2 = ParseToleranceFormat("3390±40g");                 // returns (3350, 3430, "g")
    var result3 = ParseToleranceFormat("Weight 100.5±0.5 (mm)");    // returns (100.0, 101.0, "mm")
    var result4 = ParseToleranceFormat("Invalid format");           // returns (null, null, "mm")
    */

    private bool GetDataAndInsertToDatabase(IXLWorksheet worksheet, string filePath)
    {
        try 
        {
            // Get existing data with default values if null
            var partNo = worksheet.Cell("F4").GetValue<string>() ?? "UNKNOWN";
            var partName = worksheet.Cell("F3").GetValue<string>() ?? "UNKNOWN";
            var material = worksheet.Cell("C4").GetValue<string>() ?? "";

            // Get the workbook file path
            var workbookPath = filePath;
            
            // Check if model exists
            var model = _context.Models.FirstOrDefault(m => m.PartNo == partNo);
            if (model == null)
            {
                // Create new model with images and default values
                var newModel = new Models.Model
                {
                    PartNo = partNo,
                    PartName = partName,
                    Material = material,
                    CreatedAt = DateTime.Now,
                    ProductDate = DateTime.Now, // Default to today
                    WO = "DEFAULT",            // Default WO
                    Machine = "DEFAULT"         // Default Machine
                };
                
                _logger.LogInformation("Creating new model: {NewModel}", JsonSerializer.Serialize(newModel));
                _context.Models.Add(newModel);
                
                _context.SaveChanges();

                // get the created model id
                var createdModelId = newModel.ModelId;
                _logger.LogInformation("Created model id: {CreatedModelId}", createdModelId);

                // read specs
                var specs = new List<Models.ModelSpecification>();
                var maxRowString = worksheet.Evaluate($"=MAX(A12:A100)").ToString();
                var maxRow = int.Parse(maxRowString);
                LogToFile($"Found last row with number in column A: {maxRow}");

                for (int row = 12; row <= 40; row++)
                {
                    var minMaxValueString = GetCellValue(worksheet, "D", row) ?? "";
                    if (minMaxValueString.Contains("Time"))
                    {
                        continue;
                    }
                    var (minValue, maxValue, unit) = ParseMeasurement(minMaxValueString);
                    var specNameString = GetCellValue(worksheet, "B", row) ?? "";
                    if (specNameString.Contains("Kết quả") || specNameString.Contains("Ký xác nhận") || specNameString.Contains("kết quả") || specNameString.Contains("ký xác nhận"))
                    {
                        break;
                    }
                    var equipNameString = GetCellValue(worksheet, "E", row) ?? "";

                    if (minValue == null && maxValue == null)
                    {
                        var (baseValue, tolerance, valueUnit) = ParseToleranceFormat(minMaxValueString);
                        minValue = baseValue ?? 0.0;  // Default to 0 if null
                        maxValue = tolerance ?? 0.0;  // Default to 0 if null
                        unit = valueUnit;
                    }

                    // Ensure we have default values for all numeric fields
                    minValue ??= 0.0;
                    maxValue ??= 0.0;
                    unit = string.IsNullOrEmpty(unit) ? "mm" : unit;

                    if (string.IsNullOrEmpty(specNameString))
                    {
                        continue;
                    }

                    if (minValue == 0 && maxValue == 0){
                        continue;
                    }

                    specs.Add(new Models.ModelSpecification
                    {
                        ModelId = createdModelId,
                        SpecName = string.IsNullOrEmpty(specNameString) ? "UNKNOWN" : specNameString,
                        EquipName = string.IsNullOrEmpty(equipNameString) ? "UNKNOWN" : equipNameString,
                        MinValue = minValue,
                        MaxValue = maxValue,
                        Unit = unit
                    });
                }

                _context.ModelSpecifications.AddRange(specs);
                _context.SaveChanges();
                ExcelFileSuccess?.Invoke(this, $"Model {partNo} đã được import thành công");
                LogToFile($"Specs saved!");
                
                // Extract images
                // var images = ExtractImagesAsBase64(workbookPath);
                // if (images.Count > 0)
                // {
                //     _logger.LogInformation("Extracted images! {count}", images.Count);
                //     int i = 0;
                //     foreach (var image in images)
                //     {
                //         var imageCreateRequest = new ImageCreateRequest()
                //         {
                //             ModelId = createdModelId,
                //             FileName = $"ModelImage-{createdModelId}-{i}",
                //             Base64Image = image.Split(',')[1],
                //             ContentType = image.Split(',')[0]
                //         };
                //         i++;
                //         var imageRecord = new Models.ModelImage
                //         {
                //             ModelId = createdModelId,
                //             FileName = imageCreateRequest.FileName,
                //             Base64Data = imageCreateRequest.Base64Image,
                //             ContentType = imageCreateRequest.ContentType
                //         };
                //         _context.ModelImages.Add(imageRecord);
                //         _logger.LogInformation("Created image record");
                        
                //         _context.SaveChanges();
                //     }
                // }
                // LogToFile($"Summary model created with {images.Count} images: {JsonSerializer.Serialize(newModel)}");
                ExcelFileSuccess?.Invoke(this, $"Model {partNo} đã được import thành công");
                return true;
            } 
            else 
            {
                _logger.LogWarning($"Model with PartNo {partNo} already exists");
                ExcelFileError?.Invoke(this, $"Model với PartNo {partNo} đã tồn tại");
                return false;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in GetDataAndInsertToDatabase");
            ExcelFileError?.Invoke(this, "Có lỗi xảy ra khi xử lý dữ liệu Excel.");
            return false;
        }
    }

    private string GetCellValue(IXLWorksheet worksheet, string column, int row)
    {
        var cell = worksheet.Cell($"{column}{row}");
        if (cell.IsMerged())
        {
            return cell.MergedRange().FirstCell().Value.ToString();
        }
        return cell.GetValue<string>();
    }

    private List<string> ExtractImagesAsBase64(string excelFilePath)
    {
        var base64Images = new List<string>();
        
        try
        {
            using (var spreadsheetDocument = SpreadsheetDocument.Open(excelFilePath, false))
            {
                var workbookPart = spreadsheetDocument.WorkbookPart;
                if (workbookPart == null) return base64Images;

                var sheets = workbookPart.Workbook.Descendants<Sheet>();
                foreach (var sheet in sheets)
                {
                    if (sheet.Name?.Value?.Contains("Drawing", StringComparison.OrdinalIgnoreCase) == true)
                    {
                        var worksheetPart = (WorksheetPart)workbookPart.GetPartById(sheet.Id!);
                        
                        _logger.LogInformation("Found drawing worksheet: {SheetName}", sheet.Name.Value);
                        
                        if (worksheetPart.DrawingsPart == null) continue;

                        var imageParts = worksheetPart.DrawingsPart.ImageParts;
                        foreach (var imagePart in imageParts)
                        {
                            using (var stream = imagePart.GetStream())
                            using (var memoryStream = new MemoryStream())
                            {
                                stream.CopyTo(memoryStream);
                                byte[] originalImageBytes = memoryStream.ToArray();

                                // Compress the image
                                byte[] compressedImageBytes = CompressImage(originalImageBytes, 800, 30);
                                
                                string base64String = Convert.ToBase64String(compressedImageBytes);
                                string contentType = "image/jpeg"; // We're converting all images to JPEG
                                
                                // Create complete base64 string with data URI scheme
                                string base64Image = $"data:{contentType};base64,{base64String}";
                                base64Images.Add(base64Image);

                                // Log compression results
                                double compressionRatio = (1 - ((double)compressedImageBytes.Length / originalImageBytes.Length)) * 100;
                                _logger.LogInformation(
                                    "Image compressed: Original size: {OriginalSize}KB, Compressed size: {CompressedSize}KB, Saved: {SavedPercent}%",
                                    originalImageBytes.Length / 1024,
                                    compressedImageBytes.Length / 1024,
                                    compressionRatio.ToString("F2")
                                );
                            }
                        }
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error extracting images from Excel file: {FilePath}", excelFilePath);
            ExcelFileError?.Invoke(this, $"Error extracting images: {ex.Message}");
        }

        return base64Images;
    }

    private byte[] CompressImage(byte[] imageBytes, int maxWidth, int quality)
    {
        try
        {
            using (var inputStream = new MemoryStream(imageBytes))
            using (var outputStream = new MemoryStream())
            using (var image = SixLabors.ImageSharp.Image.Load(inputStream))
            {
                // Calculate new dimensions maintaining aspect ratio
                double scale = Math.Min(1.0, (double)maxWidth / image.Width);
                int newWidth = (int)(image.Width * scale);
                int newHeight = (int)(image.Height * scale);

                // Resize the image if needed
                if (scale < 1)
                {
                    image.Mutate(x => x.Resize(newWidth, newHeight));
                }

                // Configure JPEG encoding with quality setting
                var encoder = new JpegEncoder
                {
                    Quality = quality // Adjust quality (1-100)
                };

                // Save as JPEG with compression
                image.Save(outputStream, encoder);
                return outputStream.ToArray();
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error compressing image");
            return imageBytes; // Return original if compression fails
        }
    }

    /// <summary>
    /// Extracts a part number from a file name using a predefined logic.
    /// </summary>
    /// <param name="fileName">The file name.</param>
    /// <returns>The extracted part number.</returns>
    private string ExtractPartNo(string fileName)
    {
        // Implement your logic to extract part numbers from file names
        var match = System.Text.RegularExpressions.Regex.Match(fileName, @"[A-Z]{2,}\d{5,}");
        return match.Success ? match.Value : string.Empty;
    }


    /// <summary>
    /// Saves the model list to the database.
    /// </summary>
    /// <param name="models">The models to save.</param>
    private void SaveToDatabase(List<FileInfoDto> models)
    {
        // Implement your database save logic here
        // Example:
        // using (var context = new YourDbContext())
        // {
        //     context.YourModels.AddRange(models);
        //     context.SaveChanges();
        // }
    }

    private void LogToFile(string message)
    {
        try
        {
            // Define the log directory path in wwwroot
            var logDirectory = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "logs");
            
            // Create the logs directory if it doesn't exist
            if (!Directory.Exists(logDirectory))
            {
                Directory.CreateDirectory(logDirectory);
            }

            // Define the log file path
            var logPath = Path.Combine(logDirectory, "app.log");
            
            // Append the log message with timestamp
            File.AppendAllText(logPath, $"{DateTime.Now:yyyy-MM-dd HH:mm:ss}: {message}{Environment.NewLine}");
            
            _logger.LogInformation($"Log written to {logPath}");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error writing to log file");
        }
    }
}
