using System.Text.Json;

namespace Services
{
    public class DocumentSyncService
    {
        private readonly ILogger<DocumentSyncService> _logger;
        private readonly HttpClient _httpClient;
        private readonly string _baseUrl;
        private readonly string _localPdfPath;
        private readonly IWebHostEnvironment _webHostEnvironment;
        private readonly IConfiguration _configuration;

        public DocumentSyncService(
            ILogger<DocumentSyncService> logger,
            IConfiguration configuration,
            IWebHostEnvironment webHostEnvironment)
        {
            _logger = logger;
            _httpClient = new HttpClient();
            _baseUrl = configuration["DocumentServer:BaseUrl"] ?? "http://localhost:3000";
            _webHostEnvironment = webHostEnvironment;
            _localPdfPath = Path.Combine(_webHostEnvironment.WebRootPath, "pdfs");
            _configuration = configuration;
            
            // Ensure PDF directory exists
            if (!Directory.Exists(_localPdfPath))
            {
                Directory.CreateDirectory(_localPdfPath);
            }
        }

        public async Task<SyncResult> SyncDocuments()
        {
            try
            {
                _logger.LogInformation("📄 Starting document sync");
                
                // Get server file list
                var response = await _httpClient.GetAsync($"{_baseUrl}/documents/list");
                if (!response.IsSuccessStatusCode)
                {
                    throw new Exception("Failed to get server file list");
                }

                var serverFiles = await GetServerFileList();
                _logger.LogInformation($"📄 Server files: {serverFiles.Count} files found");
                foreach (var file in serverFiles)
                {
                    _logger.LogInformation($"📄 Server file: {file.FileName}, Size: {file.FileSize}, Original: {file.OriginalName}");
                }

                var localFiles = GetLocalFileList();
                _logger.LogInformation($"📄 Local files: {localFiles.Count} files found");
                foreach (var file in localFiles)
                {
                    _logger.LogInformation($"📄 Local file: {file.FileName}, Size: {file.FileSize}");
                }

                var missingFiles = serverFiles
                    .Where(sf => !localFiles.Any(lf => 
                        lf.FileName == sf.FileName && 
                        lf.FileSizeAsLong == sf.FileSizeAsLong))
                    .ToList();

                var downloadedFiles = new List<string>();
                var failedFiles = new List<string>();

                foreach (var file in missingFiles)
                {
                    try
                    {
                        await DownloadFile(file.FileName);
                        downloadedFiles.Add(file.FileName);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, $"Failed to download {file.FileName}");
                        failedFiles.Add(file.FileName);
                    }
                }

                // Clean up orphaned files (files that exist locally but not on server)
                var orphanedFiles = localFiles
                    .Where(lf => !serverFiles.Any(sf => sf.FileName == lf.FileName))
                    .ToList();

                foreach (var file in orphanedFiles)
                {
                    try
                    {
                        var filePath = Path.Combine(_localPdfPath, file.FileName);
                        if (File.Exists(filePath))
                        {
                            File.Delete(filePath);
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, $"Failed to delete orphaned file {file.FileName}");
                    }
                }

                return new SyncResult
                {
                    Downloaded = downloadedFiles,
                    Failed = failedFiles,
                    Deleted = orphanedFiles.Select(f => f.FileName).ToList()
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Sync operation failed");
                throw;
            }
        }

        private async Task<List<DocumentInfo>> GetServerFileList()
        {
            try
            {
                _logger.LogInformation("📄 Fetching server file list from: " + _baseUrl);
                var response = await _httpClient.GetAsync($"{_baseUrl}/documents/list");
                
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogError($"Server returned status code: {response.StatusCode}");
                    throw new Exception("Failed to get server file list");
                }

                var content = await response.Content.ReadAsStringAsync();
                _logger.LogInformation("📄 Server response: " + content);

                var options = new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true,
                    WriteIndented = true
                };

                var result = JsonSerializer.Deserialize<ServerListResponse>(content, options);
                
                if (result == null)
                {
                    _logger.LogError("Failed to deserialize server response");
                    return new List<DocumentInfo>();
                }

                _logger.LogInformation($"📄 Deserialized {result.Documents.Count} documents from server");
                foreach (var doc in result.Documents)
                {
                    _logger.LogInformation($"📄 Server document: {doc.FileName}, ModelId: {doc.ModelId}, Size: {doc.FileSize}, Original: {doc.OriginalName}");
                }

                return result.Documents;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting server file list");
                throw;
            }
        }

        private List<DocumentInfo> GetLocalFileList()
        {
            try
            {
                var files = Directory.GetFiles(_localPdfPath, "*.pdf")
                    .Select(path => new DocumentInfo
                    {
                        FileName = Path.GetFileName(path),
                        FileSize = new FileInfo(path).Length.ToString(),
                        OriginalName = Path.GetFileName(path)
                    })
                    .ToList();

                _logger.LogInformation($"📄 Found {files.Count} local files");
                foreach (var file in files)
                {
                    _logger.LogInformation($"📄 Local file: {file.FileName}, Size: {file.FileSize}");
                }

                return files;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting local file list");
                return new List<DocumentInfo>();
            }
        }

        private async Task DownloadFile(string fileName)
        {
            var response = await _httpClient.GetAsync($"{_baseUrl}/documents/download/{fileName}");
            if (!response.IsSuccessStatusCode)
            {
                throw new Exception($"Failed to download {fileName}");
            }

            var filePath = Path.Combine(_localPdfPath, fileName);
            using var fileStream = File.Create(filePath);
            await response.Content.CopyToAsync(fileStream);
        }

        public string GetLocalPdfUrl(string fileName)
        {
            var baseUrl = _configuration["AppSettings:BaseUrl"] ?? "http://localhost:8123";
            var url = $"{baseUrl}/pdfs/{fileName}";
            _logger.LogInformation($"📄 Generated URL: {url} for file: {fileName}");
            return url;
        }
    }

    public class DocumentInfo
    {
        public string FileName { get; set; } = string.Empty;
        public int ModelId { get; set; }
        public DateTime UploadDate { get; set; }
        
        private string _fileSize = "0";
        public string FileSize 
        { 
            get => _fileSize;
            set 
            {
                _fileSize = value;
                FileSizeAsLong = long.TryParse(value, out long size) ? size : 0;
            }
        }
        
        public long FileSizeAsLong { get; private set; }
        
        public string OriginalName { get; set; } = string.Empty;
        public string? LocalUrl { get; set; }
    }

    public class ServerListResponse
    {
        public bool Success { get; set; }
        public List<DocumentInfo> Documents { get; set; } = new List<DocumentInfo>();
    }

    public class SyncResult
    {
        public List<string> Downloaded { get; set; } = new List<string>();
        public List<string> Failed { get; set; } = new List<string>();
        public List<string> Deleted { get; set; } = new List<string>();
    }
} 