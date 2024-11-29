using ElectronNET.API;
using ElectronNET.API.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Models;
using Models.DTO;
using Models.Requests;
using System.Text.Json;
using System.ComponentModel.DataAnnotations;

namespace Services
{
    public class DocumentIPCService : IIPCService
    {
        private readonly ILogger<DocumentIPCService> _logger;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly HttpClient _httpClient;
        private readonly string _baseUrl;
        private readonly DocumentSyncService _syncService;
        private readonly IWebHostEnvironment _webHostEnvironment;

        public DocumentIPCService(
            ILogger<DocumentIPCService> logger,
            IServiceScopeFactory scopeFactory,
            IConfiguration configuration,
            DocumentSyncService syncService,
            IWebHostEnvironment webHostEnvironment)
        {
            _logger = logger;
            _scopeFactory = scopeFactory;
            _httpClient = new HttpClient();
            _baseUrl = configuration["DocumentServer:BaseUrl"] ?? "http://localhost:3000";
            _syncService = syncService;
            _webHostEnvironment = webHostEnvironment;
        }

        public void RegisterEvents(BrowserWindow window)
        {
            RegisterUploadDocument(window);
            RegisterGetDocumentsByModel(window);
            RegisterDeleteDocument(window);
            RegisterDownloadDocument(window);
            RegisterSaveDialog(window);
            RegisterSyncDocuments(window);
        }

        private void RegisterUploadDocument(BrowserWindow window)
        {
            Electron.IpcMain.On("document-upload", async (args) =>
            {
                try
                {
                    _logger.LogInformation("📄 Received document upload request");
                    
                    var options = new JsonSerializerOptions
                    {
                        PropertyNameCaseInsensitive = true
                    };

                    var data = JsonSerializer.Deserialize<DocumentUploadRequest>(args.ToString(), options);
                    if (data == null) throw new Exception("Invalid upload data");

                    _logger.LogInformation($"📄 Processing upload for Model ID: {data.ModelId}, Upload Date: {data.UploadDate}");

                    using var multipartContent = new MultipartFormDataContent();
                    
                    // Convert base64 to file stream
                    var fileBytes = Convert.FromBase64String(data.Base64File);
                    using var fileStream = new MemoryStream(fileBytes);
                    using var fileContent = new StreamContent(fileStream);
                    
                    multipartContent.Add(fileContent, "pdf", data.FileName);
                    multipartContent.Add(new StringContent(data.ModelId.ToString()), "modelId");
                    multipartContent.Add(new StringContent(data.UploadDate.ToString("o")), "uploadDate");

                    var response = await _httpClient.PostAsync($"{_baseUrl}/upload", multipartContent);
                    var result = await response.Content.ReadAsStringAsync();

                    if (response.IsSuccessStatusCode)
                    {
                        _logger.LogInformation($"📄 Document uploaded successfully: {result}");
                        Electron.IpcMain.Send(window, "document-uploaded", result);
                    }
                    else
                    {
                        _logger.LogError($"📄 Upload failed with response: {result}");
                        throw new Exception($"Upload failed: {result}");
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError($"📄 Error uploading document: {ex.Message}");
                    Electron.IpcMain.Send(window, "document-error", JsonSerializer.Serialize(new { error = ex.Message }));
                }
            });
        }

        private void RegisterGetDocumentsByModel(BrowserWindow window)
        {
            Electron.IpcMain.On("document-getByModel", async (args) =>
            {
                try
                {
                    var modelId = JsonSerializer.Deserialize<int>(args.ToString());
                    _logger.LogInformation($"📄 Getting documents for model: {modelId}");

                    var response = await _httpClient.GetAsync($"{_baseUrl}/documents/model/{modelId}");
                    var result = await response.Content.ReadAsStringAsync();
                    _logger.LogInformation($"📄 Server response: {result}");

                    if (response.IsSuccessStatusCode)
                    {
                        var documents = JsonSerializer.Deserialize<ServerListResponse>(result);
                        _logger.LogInformation($"📄 Deserialized documents: {documents?.Documents?.Count ?? 0} documents found");

                        if (documents?.Documents != null)
                        {
                            foreach (var doc in documents.Documents)
                            {
                                doc.LocalUrl = _syncService.GetLocalPdfUrl(doc.FileName);
                                _logger.LogInformation($"📄 Document: {doc.FileName}, LocalUrl: {doc.LocalUrl}");
                            }
                        }

                        Electron.IpcMain.Send(window, "document-list", JsonSerializer.Serialize(documents));
                    }
                    else
                    {
                        _logger.LogError($"📄 Failed to get documents: {result}");
                        throw new Exception($"Failed to get documents: {result}");
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error getting documents");
                    Electron.IpcMain.Send(window, "document-error", JsonSerializer.Serialize(new { error = ex.Message }));
                }
            });
        }

        private void RegisterDeleteDocument(BrowserWindow window)
        {
            Electron.IpcMain.On("document-delete", async (args) =>
            {
                try
                {
                    var options = new JsonSerializerOptions
                    {
                        PropertyNameCaseInsensitive = true
                    };

                    var data = JsonSerializer.Deserialize<DocumentDeleteRequest>(args.ToString(), options);
                    if (data == null || data.DocumentId <= 0) 
                    {
                        throw new Exception($"Invalid document ID: {args}");
                    }

                    _logger.LogInformation($"📄 Deleting document with ID: {data.DocumentId}, FileName: {data.FileName}");

                    // Delete from server
                    var response = await _httpClient.DeleteAsync($"{_baseUrl}/documents/{data.FileName}");
                    var result = await response.Content.ReadAsStringAsync();

                    if (response.IsSuccessStatusCode)
                    {
                        // Also delete local file if it exists
                        var localFilePath = Path.Combine(_webHostEnvironment.WebRootPath, "pdfs", data.FileName);
                        if (File.Exists(localFilePath))
                        {
                            File.Delete(localFilePath);
                            _logger.LogInformation($"📄 Deleted local file: {localFilePath}");
                        }

                        _logger.LogInformation($"📄 Document deleted successfully: {data.DocumentId}");
                        Electron.IpcMain.Send(window, "document-deleted", result);
                    }
                    else
                    {
                        _logger.LogError($"📄 Server delete failed: {result}");
                        throw new Exception($"Failed to delete document: {result}");
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError($"Error deleting document: {ex.Message}");
                    Electron.IpcMain.Send(window, "document-error", JsonSerializer.Serialize(new { error = ex.Message }));
                }
            });
        }

        private void RegisterDownloadDocument(BrowserWindow window)
        {
            Electron.IpcMain.On("document-download", async (args) =>
            {
                try
                {
                    var filename = JsonSerializer.Deserialize<string>(args.ToString());
                    var response = await _httpClient.GetAsync($"{_baseUrl}/documents/download/{filename}");

                    if (response.IsSuccessStatusCode)
                    {
                        var contentDisposition = response.Content.Headers.ContentDisposition;
                        var originalFilename = contentDisposition?.FileName?.Trim('"') ?? filename;

                        // Let the renderer process know the file is ready to be saved
                        var downloadInfo = new
                        {
                            filename = filename,
                            originalName = originalFilename,
                            contentType = response.Content.Headers.ContentType?.MediaType,
                            contentLength = response.Content.Headers.ContentLength
                        };

                        _logger.LogInformation($"Document ready for download: {filename}");
                        Electron.IpcMain.Send(window, "document-download-ready", JsonSerializer.Serialize(downloadInfo));

                        // The actual file saving will be handled by the renderer process
                        // using the Electron dialog
                    }
                    else
                    {
                        var error = await response.Content.ReadAsStringAsync();
                        throw new Exception($"Failed to download document: {error}");
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError($"Error downloading document: {ex.Message}");
                    Electron.IpcMain.Send(window, "document-error", JsonSerializer.Serialize(new { error = ex.Message }));
                }
            });
        }

        private void RegisterSaveDialog(BrowserWindow window)
        {
            Electron.IpcMain.On("show-save-dialog", async (args) =>
            {
                try
                {
                    var options = JsonSerializer.Deserialize<SaveDialogOptions>(args.ToString());
                    var savePath = await Electron.Dialog.ShowSaveDialogAsync(window, options);
                    
                    if (!string.IsNullOrEmpty(savePath))
                    {
                        // Download the file and save it to the selected path
                        var downloadResponse = await _httpClient.GetAsync($"{_baseUrl}/documents/download/{options.DefaultPath}");
                        if (downloadResponse.IsSuccessStatusCode)
                        {
                            using var fileStream = File.Create(savePath);
                            await downloadResponse.Content.CopyToAsync(fileStream);
                            Electron.IpcMain.Send(window, "save-dialog-complete", JsonSerializer.Serialize(new { success = true, path = savePath }));
                        }
                        else
                        {
                            throw new Exception("Failed to download file");
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError($"Error in save dialog: {ex.Message}");
                    Electron.IpcMain.Send(window, "document-error", JsonSerializer.Serialize(new { error = ex.Message }));
                }
            });
        }

        private void RegisterSyncDocuments(BrowserWindow window)
        {
            Electron.IpcMain.On("document-sync", async (args) =>
            {
                try
                {
                    var result = await _syncService.SyncDocuments();
                    Electron.IpcMain.Send(window, "document-sync-complete", JsonSerializer.Serialize(result));
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Document sync failed");
                    Electron.IpcMain.Send(window, "document-error", JsonSerializer.Serialize(new { error = ex.Message }));
                }
            });
        }

        private JsonSerializerOptions GetJsonSerializerOptions()
        {
            return new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true,
                WriteIndented = true
            };
        }
    }

    public class DocumentUploadRequest
    {
        [Required]
        [Range(1, int.MaxValue, ErrorMessage = "Invalid Model ID")]
        public int ModelId { get; set; }

        [Required]
        public string FileName { get; set; } = string.Empty;

        [Required]
        public string Base64File { get; set; } = string.Empty;

        public DateTime UploadDate { get; set; } = DateTime.Now;
    }

    public class DocumentDeleteRequest
    {
        [Required]
        [Range(1, int.MaxValue, ErrorMessage = "Document ID must be a positive number")]
        public int DocumentId { get; set; }

        [Required]
        public string FileName { get; set; } = string.Empty;
    }
} 