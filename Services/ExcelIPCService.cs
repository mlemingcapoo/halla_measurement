using System.Text.Json;
using ElectronNET.API;
using ElectronNET.API.Entities;
using Models.Requests;
using System.IO;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;

namespace Services
{
    public class ExcelIPCService : IIPCService
    {
        private readonly ILogger<ExcelIPCService> _logger;
        private readonly ExcelExportService _excelService;
        private readonly IWebHostEnvironment _webHostEnvironment;
        private BrowserWindow? _window;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ExcelFileService _excelFileService;

        public ExcelIPCService(
            ILogger<ExcelIPCService> logger, 
            ExcelExportService excelService, 
            IServiceScopeFactory scopeFactory,
            IWebHostEnvironment webHostEnvironment,
            ExcelFileService excelFileService)
        {
            _logger = logger;
            _excelService = excelService;
            _scopeFactory = scopeFactory;
            _webHostEnvironment = webHostEnvironment;
            _excelFileService = excelFileService;
            _excelFileService.ExcelFileError += OnExcelFileError;
            _excelFileService.ExcelFileSuccess += OnExcelFileSuccess;
        }

        private void OnExcelFileError(object? sender, string errorMessage)
        {
            _logger.LogError("ExcelFileService error: " + errorMessage);
            Electron.IpcMain.Send(_window, "excel-file-error", JsonSerializer.Serialize(new { error = errorMessage }));
        }

        private void OnExcelFileSuccess(object? sender, string successMessage)
        {
            _logger.LogInformation("ExcelFileService success: " + successMessage);
            // Electron.IpcMain.Send(_window, "excel-file-success", JsonSerializer.Serialize(new { success = successMessage }));
            Electron.IpcMain.Send(_window, "import-excel-done", JsonSerializer.Serialize(new { success = successMessage }));
        }

        public void RegisterEvents(BrowserWindow window)
        {
            _window = window;

            Electron.IpcMain.On("import-selected-files", async (args) =>
            {
                try
                {
                    if (string.IsNullOrEmpty(args?.ToString()))
                    {
                        throw new ArgumentException("No files selected");
                    }

                    var files = JsonSerializer.Deserialize<FileInfoDto[]>(args.ToString());
                    if (files == null || files.Length == 0)
                    {
                        throw new ArgumentException("No valid files in selection");
                    }

                    _excelFileService.BulkImport(files);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error in import-selected-files");
                    OnExcelFileError(this, "Error processing selected files: " + ex.Message);
                }
            });

            Electron.IpcMain.On("scan-excel-folder", async (args) =>
            {
                _logger.LogInformation("Scanning Excel folder: {Folder}", args);
                // var fakeFiles = new[]
                // {
                //     new FileInfoDto { FileName = "Excel File 1.xlsx", PartNo = "ABC123" },
                //     new FileInfoDto { FileName = "Excel File 2.xlsx", PartNo = "DEF456" },
                //     new FileInfoDto { FileName = "Excel File 3.xlsx", PartNo = "GHI789" }
                // };
                var files = _excelFileService.ScanFolder(args.ToString() ?? "", @"[A-Z]{2,5}\d{5,}");
                Electron.IpcMain.Send(_window, "excel-folder-scanned", JsonSerializer.Serialize(files));
            });

            Electron.IpcMain.On("choose-folder", async (args) =>
            {
                var mainWindow = Electron.WindowManager.BrowserWindows.First();

                // Show folder selection dialog
                var options = new OpenDialogOptions
                {
                    Properties = new[] { OpenDialogProperty.openDirectory }
                };

                var result = await Electron.Dialog.ShowOpenDialogAsync(mainWindow, options);

                // Send the selected folder path back to the renderer process
                if (result?.Any() == true)
                {
                    Electron.IpcMain.Send(mainWindow, "folder-selected", JsonSerializer.Serialize(result.First()));
                }
                else
                {
                    Electron.IpcMain.Send(mainWindow, "folder-selected", null);
                }
            });

            Electron.IpcMain.On("export-measurement-by-model-and-mold", async (args) =>
            {
                try
                {
                    _logger.LogInformation("Export request received: {args}", args);
                    
                    if (string.IsNullOrEmpty(args?.ToString()))
                    {
                        throw new ArgumentException("No request data received");
                    }

                    var options = new JsonSerializerOptions
                    {
                        PropertyNameCaseInsensitive = true,
                        AllowTrailingCommas = true
                    };

                    var request = JsonSerializer.Deserialize<ExportMeasurementRequest>(args.ToString(), options);
                    
                    if (request == null)
                    {
                        throw new ArgumentNullException(nameof(request));
                    }

                    _logger.LogInformation("Deserialized request: {@Request}", request);

                    var data = await PrepareSpecificationData(request);

                    // Get products for the specified model and mold
                    using var scope = _scopeFactory.CreateScope();
                    var productService = scope.ServiceProvider.GetRequiredService<ProductIPCService>();
                    var products = await productService.GetProductsByModelId(int.Parse(request.Model));

                    // Filter by mold if specified
                    if (!string.IsNullOrEmpty(request.Mold))
                    {
                        products = products.Where(p => p.MoldNumber == request.Mold).ToList();
                    }

                    var tempFilePath = await _excelService.ExportMeasurementsToExcel(data, products);

                    // Send success response with temp file path
                    Electron.IpcMain.Send(_window, "excel-export-complete", JsonSerializer.Serialize(new { 
                        tempFilePath = tempFilePath,
                        fileName = $"measurement_report_{DateTime.Now:yyyyMMddHHmmss}.xlsx"
                    }));
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error exporting to Excel");
                    Electron.IpcMain.Send(_window, "excel-export-error", JsonSerializer.Serialize(new { error = ex.Message }));
                }
            });

            // Add new handler for save file dialog
            Electron.IpcMain.On("save-excel-file", async (args) =>
            {
                try
                {
                    _logger.LogInformation("Raw save file request received: {RawArgs}", args);

                    // Log the raw string before deserialization
                    var rawString = args?.ToString();
                    _logger.LogInformation("Args as string: {String}", rawString);

                    if (string.IsNullOrEmpty(rawString))
                    {
                        throw new ArgumentException("No data received");
                    }

                    var options = new JsonSerializerOptions
                    {
                        PropertyNameCaseInsensitive = true,
                        WriteIndented = true
                    };

                    try
                    {
                        var request = JsonSerializer.Deserialize<SaveFileRequest>(rawString, options);
                        _logger.LogInformation("Deserialized request: {@Request}", request);

                        if (request == null)
                        {
                            throw new ArgumentException("Failed to deserialize request");
                        }

                        if (string.IsNullOrEmpty(request.FileName))
                        {
                            throw new ArgumentException($"No filename provided in request: {rawString}");
                        }

                        // Log the constructed file path
                        var tempFilePath = Path.Combine(
                            _webHostEnvironment.WebRootPath,
                            "templates",
                            "excel",
                            "output",
                            request.FileName
                        );
                        _logger.LogInformation("Looking for file at: {Path}", tempFilePath);

                        if (!File.Exists(tempFilePath))
                        {
                            _logger.LogError("File not found at path: {Path}", tempFilePath);
                            throw new FileNotFoundException($"File not found: {request.FileName}");
                        }

                        var saveDialogOptions = new SaveDialogOptions
                        {
                            Title = "Save Measurement Report",
                            DefaultPath = request.DefaultFileName,
                            Filters = new FileFilter[] {
                                new FileFilter { Name = "Excel Files", Extensions = new string[] { "xlsx" } }
                            }
                        };

                        var savePath = await Electron.Dialog.ShowSaveDialogAsync(_window, saveDialogOptions);
                        if (!string.IsNullOrEmpty(savePath))
                        {
                            _logger.LogInformation("Copying from {Source} to {Destination}", tempFilePath, savePath);
                            File.Copy(tempFilePath, savePath, true);
                            Electron.IpcMain.Send(_window, "file-saved", JsonSerializer.Serialize(new { path = savePath }));
                            
                            try
                            {
                                if (File.Exists(tempFilePath))
                                {
                                    File.Delete(tempFilePath);
                                    _logger.LogInformation("Deleted temp file: {Path}", tempFilePath);
                                }
                            }
                            catch (Exception ex)
                            {
                                _logger.LogWarning("Failed to delete temp file: {Error}", ex.Message);
                            }
                        }
                        else
                        {
                            Electron.IpcMain.Send(_window, "save-cancelled", "{}");
                        }
                    }
                    catch (JsonException ex)
                    {
                        _logger.LogError(ex, "JSON deserialization failed for input: {Input}", rawString);
                        throw new ArgumentException($"Failed to parse request: {ex.Message}");
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error in save-excel-file handler");
                    Electron.IpcMain.Send(_window, "save-error", JsonSerializer.Serialize(new { error = ex.Message }));
                }
            });
        }

        private async Task<SpecificationData> PrepareSpecificationData(ExportMeasurementRequest request)
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            try {
                if (!int.TryParse(request?.Model, out int modelId))
                {
                    throw new ArgumentException($"Invalid model ID format: {request.Model}");
                }

                // Get model with specifications
                var model = await context.Models
                    .Include(m => m.Specifications)
                    .FirstOrDefaultAsync(m => m.ModelId == modelId);
                    
                if (model == null) throw new ArgumentException($"Model not found with ID: {modelId}");

                // Get products with measurements for this model
                var productsQuery = context.Products
                    .Include(p => p.Measurements)
                    .Where(p => p.ModelId == modelId)
                    .OrderBy(p => p.MeasurementDate);

                // Apply mold filter if specified
                if (!string.IsNullOrEmpty(request.Mold))
                {
                    productsQuery = productsQuery.Where(p => p.MoldNumber == request.Mold).OrderBy(p => p.MeasurementDate);
                }

                var products = await productsQuery.ToListAsync();

                _logger.LogInformation("Found {Count} products for model {ModelId}", products.Count, modelId);

                // Group measurements by specification
                var measurementsBySpec = model.Specifications
                    .OrderBy(s => s.SpecName)
                    .Select(spec => new MeasurementData
                    {
                        DimensionCode = spec.SpecName,
                        MinValue = spec.MinValue ?? 0,
                        MaxValue = spec.MaxValue ?? 0,
                        EquipName = spec.EquipName,
                        MoldValues = products
                            .Select((prod, index) => new MoldValue
                            {
                                MoldNumber = prod.MoldNumber,
                                // Find the measurement for this product and spec
                                Value = prod.Measurements
                                    .Where(m => m.SpecId == spec.SpecId)
                                    .Select(m => m.MeasuredValue)
                                    .FirstOrDefault()
                            })
                            .Where(mv => mv.Value != 0) // Only include actual measurements
                            .ToList()
                    })
                    .ToList();

                var data = new SpecificationData
                {
                    Customer = request.Customer ?? "",
                    PartName = model.PartName,
                    PartNo = model.PartNo,
                    Material = model.Material,
                    ProductionDate = model.ProductDate ?? DateTime.Now,
                    WorkOrder = model.WO,
                    Process = "",
                    InspectorA = request.InspectorA ?? "",
                    InspectorB = request.InspectorB ?? "",
                    CheckedBy = request.CheckedBy ?? "",
                    ApprovedBy = request.ApprovedBy ?? "",
                    MachineName = model.Machine,
                    MoldNumber = request.Mold ?? "All",
                    Measurements = measurementsBySpec
                };

                _logger.LogInformation("Prepared measurement data: {Data}", 
                    JsonSerializer.Serialize(data, new JsonSerializerOptions { WriteIndented = true }));
                
                return data;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error preparing measurement data");
                throw;
            }
        }
    }

} 