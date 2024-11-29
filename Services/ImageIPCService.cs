using ElectronNET.API;
using ElectronNET.API.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Models;
using Models.DTO;
using Models.Requests;
using System.Text.Json;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Processing;
using SixLabors.ImageSharp.Formats.Jpeg;

namespace Services
{
    public class ImageIPCService : IIPCService
    {
        private readonly ILogger<ImageIPCService> _logger;
        private readonly IServiceScopeFactory _scopeFactory;

        public ImageIPCService(
            ILogger<ImageIPCService> logger,
            IServiceScopeFactory scopeFactory)
        {
            _logger = logger;
            _scopeFactory = scopeFactory;
        }

        public void RegisterEvents(BrowserWindow window)
        {
            RegisterCreateImage(window);
            RegisterGetImagesByModel(window);
            RegisterUpdateImage(window);
            RegisterDeleteImage(window);
            RegisterDebugCheckImages(window);
        }

        private void RegisterCreateImage(BrowserWindow window)
        {
            Electron.IpcMain.On("image-create", async (args) =>
            {
                using var scope = _scopeFactory.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                try
                {
                    _logger.LogInformation("📸 [Image Create] Starting image creation process");
                    var data = JsonSerializer.Deserialize<ImageCreateRequest>(args.ToString(), GetJsonSerializerOptions());

                    if (data == null) throw new Exception("Invalid image data");

                    _logger.LogInformation($"📸 [Image Create] Creating image for ModelId: {data.ModelId}");
                    _logger.LogInformation($"📸 [Image Create] File name: {data.FileName}");

                    // Verify model exists
                    var model = await context.Models.FindAsync(data.ModelId);
                    if (model == null)
                    {
                        throw new Exception($"Model with ID {data.ModelId} not found");
                    }
                    _logger.LogInformation($"📸 [Image Create] Found model: {model.PartNo}");

                    // Clean and validate base64 string
                    string base64Data = data.Base64Image;
                    if (base64Data.Contains(","))
                    {
                        // Remove data URL prefix if present
                        base64Data = base64Data.Split(',')[1];
                    }

                    // Remove any whitespace
                    base64Data = base64Data.Trim().Replace(" ", "").Replace("\n", "").Replace("\r", "");

                    try
                    {
                        // Compress the image before saving
                        byte[] originalImageBytes = Convert.FromBase64String(base64Data);
                        byte[] compressedImageBytes = CompressImage(originalImageBytes, 800, 10);
                        string compressedBase64 = Convert.ToBase64String(compressedImageBytes);

                        // Log compression results
                        double compressionRatio = (1 - ((double)compressedImageBytes.Length / originalImageBytes.Length)) * 100;
                        _logger.LogInformation(
                            "Image compressed: Original size: {OriginalSize}KB, Compressed size: {CompressedSize}KB, Saved: {SavedPercent}%",
                            originalImageBytes.Length / 1024,
                            compressedImageBytes.Length / 1024,
                            compressionRatio.ToString("F2")
                        );

                        // Create image record with compressed data
                        var image = new ModelImage
                        {
                            ModelId = data.ModelId,
                            FileName = data.FileName,
                            Base64Data = compressedBase64,
                            ContentType = "image/jpeg" // We're converting all images to JPEG
                        };

                        context.ModelImages.Add(image);
                        await context.SaveChangesAsync();
                        _logger.LogInformation($"📸 [Image Create] Image record created with ID: {image.ImageId}");

                        var imageDTO = new ImageDTO
                        {
                            ImageId = image.ImageId,
                            ModelId = image.ModelId,
                            FileName = image.FileName,
                            Base64Data = image.Base64Data,
                            ContentType = image.ContentType
                        };

                        _logger.LogInformation("📸 [Image Create] Sending response to client");
                        Electron.IpcMain.Send(window, "image-created", JsonSerializer.Serialize(imageDTO));
                    }
                    catch (FormatException fex)
                    {
                        _logger.LogError($"📸 [Image Create] Base64 Format Error: {fex.Message}");
                        _logger.LogError($"📸 [Image Create] Base64 string length: {base64Data.Length}");
                        _logger.LogError($"📸 [Image Create] First 100 chars: {base64Data.Substring(0, Math.Min(100, base64Data.Length))}");
                        throw new Exception("Invalid image format. Please ensure you're uploading a valid image file.");
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError($"📸 [Image Create] Error: {ex.Message}");
                    _logger.LogError($"📸 [Image Create] Stack trace: {ex.StackTrace}");
                    Electron.IpcMain.Send(window, "image-error", JsonSerializer.Serialize(new { error = ex.Message }));
                }
            });
        }

        private void RegisterGetImagesByModel(BrowserWindow window)
        {
            Electron.IpcMain.On("image-getByModel", async (args) =>
            {
                using var scope = _scopeFactory.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                try
                {
                    var modelId = JsonSerializer.Deserialize<int>(args.ToString());
                    _logger.LogInformation($"📸 [Server] Getting images for model {modelId}");

                    var images = await context.ModelImages
                        .Where(i => i.ModelId == modelId)
                        .ToListAsync();

                    _logger.LogInformation($"📸 [Server] Found {images.Count} images");

                    var imageDTOs = images.Select(i => {
                        _logger.LogInformation($"📸 [Server] Processing image {i.ImageId}: {i.FileName}");
                        _logger.LogInformation($"📸 [Server] Base64 length: {i.Base64Data?.Length ?? 0}");
                        
                        return new ImageDTO
                        {
                            ImageId = i.ImageId,
                            ModelId = i.ModelId,
                            FileName = i.FileName,
                            Base64Data = i.Base64Data,
                            ContentType = i.ContentType
                        };
                    }).ToList();

                    _logger.LogInformation($"📸 [Server] Sending {imageDTOs.Count} image DTOs");
                    var serialized = JsonSerializer.Serialize(imageDTOs, GetJsonSerializerOptions());
                    _logger.LogInformation($"📸 [Server] Serialized data length: {serialized.Length}");

                    Electron.IpcMain.Send(window, "image-list", serialized);
                }
                catch (Exception ex)
                {
                    _logger.LogError($"❌ [Server] Error getting images: {ex.Message}");
                    _logger.LogError($"❌ [Server] Stack trace: {ex.StackTrace}");
                    Electron.IpcMain.Send(window, "image-error", JsonSerializer.Serialize(new { error = ex.Message }));
                }
            });
        }

        private void RegisterUpdateImage(BrowserWindow window)
        {
            Electron.IpcMain.On("image-update", async (args) =>
            {
                using var scope = _scopeFactory.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                try
                {
                    var data = JsonSerializer.Deserialize<ImageUpdateRequest>(args.ToString(), GetJsonSerializerOptions());
                    if (data == null) throw new Exception("Invalid update data");

                    var image = await context.ModelImages.FindAsync(data.ImageId);
                    if (image == null)
                    {
                        throw new Exception($"Image with ID {data.ImageId} not found");
                    }

                    if (data.FileName != null)
                    {
                        image.FileName = data.FileName;
                    }

                    await context.SaveChangesAsync();

                    var imageDTO = new ImageDTO
                    {
                        ImageId = image.ImageId,
                        ModelId = image.ModelId,
                        FileName = image.FileName ?? string.Empty
                    };

                    _logger.LogInformation($"Updated image: {image.ImageId}");
                    Electron.IpcMain.Send(window, "image-updated", JsonSerializer.Serialize(imageDTO, GetJsonSerializerOptions()));
                }
                catch (Exception ex)
                {
                    _logger.LogError($"Error updating image: {ex.Message}");
                    Electron.IpcMain.Send(window, "image-error", JsonSerializer.Serialize(new { error = ex.Message }));
                }
            });
        }

        private void RegisterDeleteImage(BrowserWindow window)
        {
            Electron.IpcMain.On("image-delete", async (args) =>
            {
                using var scope = _scopeFactory.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                try
                {
                    var imageId = JsonSerializer.Deserialize<int>(args.ToString());
                    var image = await context.ModelImages.FindAsync(imageId);

                    if (image == null)
                    {
                        // Image already deleted, return success
                        _logger.LogInformation($"Image {imageId} already deleted");
                        Electron.IpcMain.Send(window, "image-deleted", JsonSerializer.Serialize(new { success = true }));
                        return;
                    }

                    context.ModelImages.Remove(image);
                    await context.SaveChangesAsync();

                    _logger.LogInformation($"Image {imageId} deleted successfully");
                    Electron.IpcMain.Send(window, "image-deleted", JsonSerializer.Serialize(new { success = true }));
                }
                catch (Exception ex)
                {
                    _logger.LogError($"Error deleting image: {ex.Message}");
                    Electron.IpcMain.Send(window, "image-error", JsonSerializer.Serialize(new { error = ex.Message }));
                }
            });
        }

        private void RegisterDebugCheckImages(BrowserWindow window)
        {
            Electron.IpcMain.On("debug-check-images", async (args) =>
            {
                using var scope = _scopeFactory.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                try
                {
                    var images = await context.ModelImages
                        .Include(i => i.Model)
                        .ToListAsync();

                    var debug = new
                    {
                        TotalImages = images.Count,
                        Images = images.Select(i => new
                        {
                            i.ImageId,
                            i.ModelId,
                            ModelCode = i.Model?.PartNo ?? "No Model",
                            i.FileName,
                            Exists = System.IO.File.Exists(Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "images", "models", i.FileName ?? string.Empty))
                        })
                    };

                    _logger.LogInformation($"🔍 [Debug] Database state: {JsonSerializer.Serialize(debug)}");
                    Electron.IpcMain.Send(window, "debug-images-result", JsonSerializer.Serialize(debug));
                }
                catch (Exception ex)
                {
                    _logger.LogError($"🔍 [Debug] Error checking images: {ex.Message}");
                }
            });
        }

        private JsonSerializerOptions GetJsonSerializerOptions()
        {
            return new JsonSerializerOptions
            {
                ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles,
                PropertyNameCaseInsensitive = true
            };
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
    }
} 