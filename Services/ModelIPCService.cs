using ElectronNET.API;
using ElectronNET.API.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Models;
using Models.DTO;
using Models.Requests;
using System.Text.Json;

namespace Services
{
    public class ModelIPCService : IIPCService
    {
        private readonly ILogger<ModelIPCService> _logger;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ActionHistoryService _historyService;

        public ModelIPCService(
            ILogger<ModelIPCService> logger,
            IServiceScopeFactory scopeFactory,
            ActionHistoryService historyService)
        {
            _logger = logger;
            _scopeFactory = scopeFactory;
            _historyService = historyService;
        }

        public void RegisterEvents(BrowserWindow window)
        {
            RegisterCreateModel(window);
            RegisterGetAllModels(window);
            RegisterGetModelById(window);
            RegisterUpdateModel(window);
            RegisterDeleteModel(window);
            RegisterCloneModel(window);
        }

        private void RegisterCreateModel(BrowserWindow window)
        {
            Electron.IpcMain.On("model-create", async (args) =>
            {
                using var scope = _scopeFactory.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                try
                {
                    _logger.LogInformation("Model data received: " + args.ToString());
                    var data = JsonSerializer.Deserialize<ModelCreateRequest>(args.ToString(),
                        new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

                    if (data == null) throw new Exception("Invalid model data");

                    // Check if PartNo already exists
                    var exists = await context.Models.AnyAsync(m => m.PartNo == data.PartNo);
                    if (exists)
                    {
                        throw new Exception($"Model with Part No {data.PartNo} already exists");
                    }

                    var model = new Model
                    {
                        PartNo = data.PartNo,
                        PartName = data.PartName,
                        Material = data.Material,
                        CreatedAt = DateTime.Now,
                        ProductDate = data.ProductDate ?? DateTime.Now,
                        WO = data.WO,
                        Machine = data.Machine
                    };

                    if (data.Specifications != null)
                    {
                        foreach (var spec in data.Specifications)
                        {
                            model.Specifications.Add(new ModelSpecification
                            {
                                SpecName = spec.SpecName,
                                MinValue = spec.MinValue,
                                MaxValue = spec.MaxValue,
                                Unit = spec.Unit
                            });
                        }
                    }

                    context.Models.Add(model);
                    await context.SaveChangesAsync();

                    var modelDTO = new ModelDTO
                    {
                        ModelId = model.ModelId,
                        PartNo = model.PartNo,
                        PartName = model.PartName,
                        Material = model.Material,
                        CreatedAt = model.CreatedAt,
                        ProductDate = model.ProductDate ?? DateTime.Now,
                        WO = model.WO,
                        Machine = model.Machine,
                        Specifications = model.Specifications.Select(s => new SpecificationDTO
                        {
                            SpecId = s.SpecId,
                            ModelId = s.ModelId,
                            SpecName = s.SpecName,
                            MinValue = s.MinValue ?? 0,
                            MaxValue = s.MaxValue ?? 0,
                            Unit = s.Unit
                        }).ToList()
                    };

                    _logger.LogInformation($"Created model: {model.ModelId}");
                    Electron.IpcMain.Send(window, "model-created", JsonSerializer.Serialize(modelDTO, GetJsonSerializerOptions()));
                    await _historyService.TrackCreate(
                        "Models", 
                        model.ModelId,
                        $"Created model: {model.PartNo} - {model.PartName}");
                }
                catch (Exception ex)
                {
                    _logger.LogError($"Error creating model: {ex.Message}");
                    Electron.IpcMain.Send(window, "model-error", JsonSerializer.Serialize(new { error = ex.Message }));
                }
            });
        }

        private void RegisterGetAllModels(BrowserWindow window)
        {
            Electron.IpcMain.On("model-getAll", async (args) =>
            {
                using var scope = _scopeFactory.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                try
                {
                    var models = await context.Models
                        .Include(m => m.Specifications)
                        .Include(m => m.Images)
                        .ToListAsync();

                    var modelDTOs = models.Select(m => new ModelDTO
                    {
                        ModelId = m.ModelId,
                        PartNo = m.PartNo,
                        PartName = m.PartName,
                        Material = m.Material,
                        CreatedAt = m.CreatedAt,
                        ProductDate = m.ProductDate ?? DateTime.Now,
                        WO = m.WO,
                        Machine = m.Machine,
                        Images = m.Images.Select(i => new ImageDTO
                        {
                            ImageId = i.ImageId,
                            ModelId = i.ModelId,
                            FileName = i.FileName,
                            Base64Data = i.Base64Data,
                            ContentType = i.ContentType
                        }).ToList(),
                        Specifications = m.Specifications.Select(s => new SpecificationDTO
                        {
                            SpecId = s.SpecId,
                            ModelId = s.ModelId,
                            SpecName = s.SpecName,
                            MinValue = s.MinValue ?? 0,
                            MaxValue = s.MaxValue ?? 0,
                            Unit = s.Unit
                        }).ToList()
                    }).ToList();

                    _logger.LogInformation($"Retrieved {models.Count} models with their images and specifications");
                    Electron.IpcMain.Send(window, "model-list", JsonSerializer.Serialize(modelDTOs, GetJsonSerializerOptions()));
                }
                catch (Exception ex)
                {
                    _logger.LogError($"Error getting models: {ex.Message}");
                    Electron.IpcMain.Send(window, "model-error", JsonSerializer.Serialize(new { error = ex.Message }));
                }
            });
        }

        private void RegisterGetModelById(BrowserWindow window)
        {
            Electron.IpcMain.On("model-getById", async (args) =>
            {
                using var scope = _scopeFactory.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                try
                {
                    var id = JsonSerializer.Deserialize<int>(args.ToString());
                    _logger.LogInformation($"⭐ [Server] Getting model {id} with documents");

                    var model = await context.Models
                        .Include(m => m.Images)
                        .Include(m => m.Documents)
                        .Include(m => m.Specifications)
                        .FirstOrDefaultAsync(m => m.ModelId == id);

                    if (model == null)
                    {
                        throw new Exception($"Model with ID {id} not found");
                    }

                    var modelDTO = new ModelDTO
                    {
                        ModelId = model.ModelId,
                        PartNo = model.PartNo,
                        PartName = model.PartName,
                        Material = model.Material,
                        CreatedAt = model.CreatedAt,
                        ProductDate = model.ProductDate ?? DateTime.Now,
                        WO = model.WO,
                        Machine = model.Machine,
                        Images = model.Images.Select(i => new ImageDTO
                        {
                            ImageId = i.ImageId,
                            ModelId = i.ModelId,
                            FileName = i.FileName,
                            Base64Data = i.Base64Data,
                            ContentType = i.ContentType
                        }).ToList(),
                        Documents = model.Documents.Select(d => new ModelDocumentDTO
                        {
                            DocumentId = d.DocumentId,
                            ModelId = d.ModelId,
                            FileName = d.FileName,
                            OriginalName = d.OriginalName,
                            FileSize = d.FileSize,
                            UploadDate = d.UploadDate
                        }).ToList(),
                        Specifications = model.Specifications.Select(s => new SpecificationDTO
                        {
                            SpecId = s.SpecId,
                            ModelId = s.ModelId,
                            SpecName = s.SpecName,
                            MinValue = s.MinValue ?? 0,
                            MaxValue = s.MaxValue ?? 0,
                            Unit = s.Unit
                        }).ToList()
                    };

                    _logger.LogInformation($"⭐ [Server] Model DTO created with {modelDTO.Documents?.Count ?? 0} documents");
                    
                    Electron.IpcMain.Send(window, "model-details", JsonSerializer.Serialize(modelDTO));
                }
                catch (Exception ex)
                {
                    _logger.LogError($"Error getting model: {ex.Message}");
                    Electron.IpcMain.Send(window, "model-error", JsonSerializer.Serialize(new { error = ex.Message }));
                }
            });
        }

        private void RegisterUpdateModel(BrowserWindow window)
        {
            Electron.IpcMain.On("model-update", async (args) =>
            {
                using var scope = _scopeFactory.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                try
                {
                    _logger.LogInformation("Update data received: " + args.ToString());
                    var data = JsonSerializer.Deserialize<ModelUpdateRequest>(args.ToString(),
                        new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

                    if (data == null) throw new Exception("Invalid update data");

                    var model = await context.Models
                        .Include(m => m.Specifications)
                        .FirstOrDefaultAsync(m => m.ModelId == data.ModelId);

                    if (model == null)
                    {
                        throw new Exception($"Model with ID {data.ModelId} not found");
                    }

                    model.PartNo = data.PartNo;
                    model.PartName = data.PartName;
                    model.Material = data.Material;
                    model.ProductDate = data.ProductDate;
                    model.WO = data.WO;
                    model.Machine = data.Machine;

                    await context.SaveChangesAsync();

                    var modelDTO = new ModelDTO
                    {
                        ModelId = model.ModelId,
                        PartNo = model.PartNo,
                        PartName = model.PartName,
                        Material = model.Material,
                        CreatedAt = model.CreatedAt,
                        ProductDate = model.ProductDate ?? DateTime.Now,
                        WO = model.WO,
                        Machine = model.Machine,
                        Specifications = model.Specifications.Select(s => new SpecificationDTO
                        {
                            SpecId = s.SpecId,
                            ModelId = s.ModelId,
                            SpecName = s.SpecName,
                            MinValue = s.MinValue ?? 0,
                            MaxValue = s.MaxValue ?? 0,
                            Unit = s.Unit
                        }).ToList()
                    };

                    _logger.LogInformation($"Updated model: {model.ModelId}");
                    Electron.IpcMain.Send(window, "model-updated", JsonSerializer.Serialize(modelDTO, GetJsonSerializerOptions()));
                    await _historyService.TrackUpdate(
                        "Models",
                        "PartNo",
                        model.ModelId,
                        model.PartNo,
                        data.PartNo);
                    await _historyService.TrackUpdate(
                        "Models",
                        "PartName",
                        model.ModelId,
                        model.PartName,
                        data.PartName);
                    await _historyService.TrackUpdate(
                        "Models",
                        "Material",
                        model.ModelId,
                        model.Material,
                        data.Material);
                    await _historyService.TrackUpdate(
                        "Models",
                        "WO",
                        model.ModelId,
                        model.WO,
                        data.WO);
                    await _historyService.TrackUpdate(
                        "Models",
                        "Machine",
                        model.ModelId,
                        model.Machine,
                        data.Machine);
                    await _historyService.TrackUpdate(
                        "Models",
                        "ProductDate",
                        model.ModelId,
                        model.ProductDate.ToString(),
                        data.ProductDate.ToString());
                }
                catch (Exception ex)
                {
                    _logger.LogError($"Error updating model: {ex.Message}");
                    Electron.IpcMain.Send(window, "model-error", JsonSerializer.Serialize(new { error = ex.Message }));
                }
            });
        }

        private void RegisterDeleteModel(BrowserWindow window)
        {
            Electron.IpcMain.On("model-delete", async (args) =>
            {
                using var scope = _scopeFactory.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                try
                {
                    var id = JsonSerializer.Deserialize<int>(args.ToString());
                    
                    // Get the execution strategy
                    var strategy = context.Database.CreateExecutionStrategy();

                    // Execute the delete operation with retry strategy
                    await strategy.ExecuteAsync(async () =>
                    {
                        // Start a new transaction
                        using var transaction = await context.Database.BeginTransactionAsync();
                        try
                        {
                            var model = await context.Models
                                .Include(m => m.Specifications)
                                .Include(m => m.Products)
                                    .ThenInclude(p => p.Measurements)
                                .FirstOrDefaultAsync(m => m.ModelId == id);

                            if (model == null)
                            {
                                throw new Exception($"Model with ID {id} not found");
                            }

                            // First, delete all specifications (this will set SpecId to null in related measurements)
                            if (model.Specifications != null && model.Specifications.Any())
                            {
                                context.ModelSpecifications.RemoveRange(model.Specifications);
                                await context.SaveChangesAsync();
                            }

                            // Then delete all measurements related to products
                            if (model.Products != null && model.Products.Any())
                            {
                                var measurements = model.Products.SelectMany(p => p.Measurements).ToList();
                                if (measurements.Any())
                                {
                                    context.Measurements.RemoveRange(measurements);
                                    await context.SaveChangesAsync();
                                }
                            }

                            // Now delete the products
                            if (model.Products != null && model.Products.Any())
                            {
                                context.Products.RemoveRange(model.Products);
                                await context.SaveChangesAsync();
                            }

                            // Finally delete the model
                            context.Models.Remove(model);
                            await context.SaveChangesAsync();

                            // Commit the transaction
                            await transaction.CommitAsync();

                            _logger.LogInformation($"Deleted model: {id} and all related data");
                            await _historyService.TrackDelete(
                                "Models", 
                                id,
                                $"Deleted model: {model.PartNo} - {model.PartName}");
                        }
                        catch (Exception ex)
                        {
                            // If anything fails, roll back the entire transaction
                            await transaction.RollbackAsync();
                            throw new Exception($"Failed to delete model and related data: {ex.Message}", ex);
                        }
                    });

                    // Send success response
                    Electron.IpcMain.Send(window, "model-deleted", JsonSerializer.Serialize(new { success = true, id = id }));
                }
                catch (Exception ex)
                {
                    _logger.LogError($"Error deleting model: {ex.Message}");
                    Electron.IpcMain.Send(window, "model-error", JsonSerializer.Serialize(new { error = ex.Message }));
                }
            });
        }

        private void RegisterCloneModel(BrowserWindow window)
        {
            Electron.IpcMain.On("model-clone", async (args) =>
            {
                using var scope = _scopeFactory.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                try
                {
                    var modelId = JsonSerializer.Deserialize<int>(args.ToString());
                    
                    // Include images in the query
                    var sourceModel = await context.Models
                        .Include(m => m.Specifications)
                        .Include(m => m.Images)  // Make sure to include images
                        .FirstOrDefaultAsync(m => m.ModelId == modelId);

                    if (sourceModel == null)
                    {
                        throw new Exception($"Source model with ID {modelId} not found");
                    }

                    // Create new model with copied data
                    var newModel = new Model
                    {
                        PartNo = sourceModel.PartNo,
                        PartName = sourceModel.PartName,
                        Material = sourceModel.Material,
                        CreatedAt = DateTime.Now,
                        ProductDate = DateTime.Now,
                        WO = sourceModel.WO,
                        Machine = sourceModel.Machine
                    };

                    // Clone specifications with EquipName
                    foreach (var spec in sourceModel.Specifications)
                    {
                        newModel.Specifications.Add(new ModelSpecification
                        {
                            SpecName = spec.SpecName,
                            EquipName = spec.EquipName,
                            MinValue = spec.MinValue,
                            MaxValue = spec.MaxValue,
                            Unit = spec.Unit
                        });
                    }

                    // Add the model first to get its ID
                    context.Models.Add(newModel);
                    await context.SaveChangesAsync();

                    // Now clone images with all data
                    if (sourceModel.Images != null && sourceModel.Images.Any())
                    {
                        foreach (var sourceImage in sourceModel.Images)
                        {
                            var newImage = new ModelImage
                            {
                                ModelId = newModel.ModelId,
                                FileName = sourceImage.FileName,
                                Base64Data = sourceImage.Base64Data,
                                ContentType = sourceImage.ContentType
                            };
                            context.ModelImages.Add(newImage);
                        }
                        await context.SaveChangesAsync();
                    }

                    // Create DTO for response
                    var modelDTO = new ModelDTO
                    {
                        ModelId = newModel.ModelId,
                        PartNo = newModel.PartNo,
                        PartName = newModel.PartName,
                        Material = newModel.Material,
                        CreatedAt = newModel.CreatedAt,
                        ProductDate = newModel.ProductDate ?? DateTime.Now,
                        WO = newModel.WO,
                        Machine = newModel.Machine,
                        Specifications = newModel.Specifications.Select(s => new SpecificationDTO
                        {
                            SpecId = s.SpecId,
                            ModelId = s.ModelId,
                            SpecName = s.SpecName,
                            EquipName = s.EquipName,
                            MinValue = s.MinValue ?? 0,
                            MaxValue = s.MaxValue ?? 0,
                            Unit = s.Unit
                        }).ToList(),
                        Images = newModel.Images.Select(i => new ImageDTO
                        {
                            ImageId = i.ImageId,
                            ModelId = i.ModelId,
                            FileName = i.FileName,
                            Base64Data = i.Base64Data,
                            ContentType = i.ContentType
                        }).ToList()
                    };

                    _logger.LogInformation($"Cloned model {modelId} to new model {newModel.ModelId}");
                    Electron.IpcMain.Send(window, "model-cloned", JsonSerializer.Serialize(modelDTO, GetJsonSerializerOptions()));
                    await _historyService.TrackCreate(
                        "Models", 
                        newModel.ModelId,
                        $"Cloned from model {sourceModel.ModelId}: {newModel.PartNo} - {newModel.PartName}");
                }
                catch (Exception ex)
                {
                    _logger.LogError($"Error cloning model: {ex.Message}");
                    Electron.IpcMain.Send(window, "model-error", JsonSerializer.Serialize(new { error = ex.Message }));
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
    }
} 