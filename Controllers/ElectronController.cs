using ElectronNET.API;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Models;
using Microsoft.Extensions.Logging;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;

public class ElectronController : Controller
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<ElectronController> _logger;

    public ElectronController(IServiceScopeFactory scopeFactory, ILogger<ElectronController> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    public void SetupIPC(BrowserWindow window)
    {
        if (!HybridSupport.IsElectronActive)
        {
            _logger.LogError("Electron is not active!");
            return;
        }

        Electron.IpcMain.On("spec-create", async (args) =>
{
    using var scope = _scopeFactory.CreateScope();
    var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

    try
    {
        _logger.LogInformation("Specification data received: " + args.ToString());
        var data = JsonSerializer.Deserialize<SpecificationRequest>(args.ToString(), GetJsonSerializerOptions());

        if (data == null) throw new Exception("Invalid specification data");

        var model = await context.Models.FindAsync(data.ModelId);
        if (model == null)
        {
            throw new Exception($"Model with ID {data.ModelId} not found");
        }

        var spec = new ModelSpecification
        {
            ModelId = data.ModelId,
            SpecName = data.SpecName,
            MinValue = data.MinValue,
            MaxValue = data.MaxValue,
            Unit = data.Unit,
            DisplayOrder = data.DisplayOrder
        };

        context.ModelSpecifications.Add(spec);
        await context.SaveChangesAsync();

        _logger.LogInformation($"Created specification: {spec.SpecId}");
        Electron.IpcMain.Send(window, "spec-created", JsonSerializer.Serialize(spec, GetJsonSerializerOptions()));
    }
    catch (Exception ex)
    {
        _logger.LogError($"Error creating specification: {ex.Message}");
        Electron.IpcMain.Send(window, "spec-error", JsonSerializer.Serialize(new { error = ex.Message }));
    }
});

        // Get Specifications for Model
        Electron.IpcMain.On("spec-getAll", async (args) =>
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            try
            {
                var request = JsonSerializer.Deserialize<GetSpecsRequest>(args.ToString(), GetJsonSerializerOptions());
                if (request == null) throw new Exception("Invalid request");

                var specs = await context.ModelSpecifications
                    .Where(s => s.ModelId == request.ModelId)
                    .OrderBy(s => s.DisplayOrder)
                    .ToListAsync();

                var specDTOs = specs.Select(s => new SpecificationDTO
                {
                    SpecId = s.SpecId,
                    ModelId = s.ModelId,
                    SpecName = s.SpecName,
                    MinValue = s.MinValue,
                    MaxValue = s.MaxValue,
                    Unit = s.Unit,
                    DisplayOrder = s.DisplayOrder
                }).ToList();

                _logger.LogInformation($"Retrieved {specs.Count} specifications for model {request.ModelId}");
                Electron.IpcMain.Send(window, "spec-list", JsonSerializer.Serialize(specDTOs, GetJsonSerializerOptions()));
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error getting specifications: {ex.Message}");
                Electron.IpcMain.Send(window, "spec-error", JsonSerializer.Serialize(new { error = ex.Message }));
            }
        });

        // Update Specification
        Electron.IpcMain.On("spec-update", async (args) =>
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            try
            {
                var data = JsonSerializer.Deserialize<SpecificationUpdateRequest>(args.ToString(),
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

                if (data == null) throw new Exception("Invalid update data");

                var spec = await context.ModelSpecifications.FindAsync(data.SpecId);
                if (spec == null)
                {
                    throw new Exception($"Specification with ID {data.SpecId} not found");
                }

                spec.SpecName = data.SpecName;
                spec.MinValue = data.MinValue;
                spec.MaxValue = data.MaxValue;
                spec.Unit = data.Unit;
                spec.DisplayOrder = data.DisplayOrder;

                await context.SaveChangesAsync();

                _logger.LogInformation($"Updated specification: {spec.SpecId}");
                Electron.IpcMain.Send(window, "spec-updated", JsonSerializer.Serialize(spec));
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error updating specification: {ex.Message}");
                Electron.IpcMain.Send(window, "spec-error", JsonSerializer.Serialize(new { error = ex.Message }));
            }
        });

        // Delete Specification
        Electron.IpcMain.On("spec-delete", async (args) =>
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            try
            {
                var specId = JsonSerializer.Deserialize<int>(args.ToString());
                var spec = await context.ModelSpecifications.FindAsync(specId);

                if (spec == null)
                {
                    throw new Exception($"Specification with ID {specId} not found");
                }

                context.ModelSpecifications.Remove(spec);
                await context.SaveChangesAsync();

                _logger.LogInformation($"Deleted specification: {specId}");
                Electron.IpcMain.Send(window, "spec-deleted", JsonSerializer.Serialize(new { success = true, id = specId }));
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error deleting specification: {ex.Message}");
                Electron.IpcMain.Send(window, "spec-error", JsonSerializer.Serialize(new { error = ex.Message }));
            }
        });

        // Create Model
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

                // Check if ModelCode already exists
                var exists = await context.Models.AnyAsync(m => m.ModelCode == data.ModelCode);
                if (exists)
                {
                    throw new Exception($"Model with code {data.ModelCode} already exists");
                }

                var model = new Model
                {
                    ModelCode = data.ModelCode,
                    ModelName = data.ModelName,
                    Description = data.Description,
                    CreatedAt = DateTime.Now,
                    TotalProducts = 0
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
                            Unit = spec.Unit,
                            DisplayOrder = spec.DisplayOrder
                        });
                    }
                }

                context.Models.Add(model);
                await context.SaveChangesAsync();

                _logger.LogInformation($"Created model: {model.ModelId}");
                Electron.IpcMain.Send(window, "model-created", JsonSerializer.Serialize(model));
            }
            catch (Exception ex)
            {
                var errorMessage = ex.InnerException?.Message ?? ex.Message;
                _logger.LogError($"Error creating model: {errorMessage}");
                Electron.IpcMain.Send(window, "model-error", JsonSerializer.Serialize(new { error = errorMessage }));
            }
        });

        // Get All Models
        Electron.IpcMain.On("model-getAll", async (args) =>
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            try
            {
                var models = await context.Models
                    .Include(m => m.Specifications)
                    .ToListAsync();

                // Convert to DTO to avoid circular references
                var modelDTOs = models.Select(m => new ModelDTO
                {
                    ModelId = m.ModelId,
                    ModelCode = m.ModelCode,
                    ModelName = m.ModelName,
                    Description = m.Description,
                    CreatedAt = m.CreatedAt,
                    TotalProducts = m.TotalProducts,
                    Specifications = m.Specifications.Select(s => new SpecificationDTO
                    {
                        SpecId = s.SpecId,
                        ModelId = s.ModelId,
                        SpecName = s.SpecName,
                        MinValue = s.MinValue,
                        MaxValue = s.MaxValue,
                        Unit = s.Unit,
                        DisplayOrder = s.DisplayOrder
                    }).ToList()
                }).ToList();

                _logger.LogInformation($"Retrieved {models.Count} models");
                Electron.IpcMain.Send(window, "model-list", JsonSerializer.Serialize(modelDTOs, GetJsonSerializerOptions()));
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error getting models: {ex.Message}");
                Electron.IpcMain.Send(window, "model-error", JsonSerializer.Serialize(new { error = ex.Message }));
            }
        });

        // Get Model by ID
        Electron.IpcMain.On("model-getById", async (args) =>
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            try
            {
                var id = JsonSerializer.Deserialize<int>(args.ToString());
                var model = await context.Models
                    .Include(m => m.Specifications)
                    .FirstOrDefaultAsync(m => m.ModelId == id);

                if (model == null)
                {
                    throw new Exception($"Model with ID {id} not found");
                }

                _logger.LogInformation($"Retrieved model: {id}");
                Electron.IpcMain.Send(window, "model-details", JsonSerializer.Serialize(model));
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error getting model: {ex.Message}");
                Electron.IpcMain.Send(window, "model-error", JsonSerializer.Serialize(new { error = ex.Message }));
            }
        });

        // Update Model
        Electron.IpcMain.On("model-update", async (args) =>
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            try
            {
                _logger.LogInformation("Update data received: " + args.ToString());
                var data = JsonSerializer.Deserialize<ModelUpdateRequest>(args.ToString(),
                    new JsonSerializerOptions
                    {
                        PropertyNameCaseInsensitive = true
                    });

                if (data == null) throw new Exception("Invalid update data");

                _logger.LogInformation($"Looking for model with ID: {data.ModelId}");
                var model = await context.Models
                    .Include(m => m.Specifications)
                    .FirstOrDefaultAsync(m => m.ModelId == data.ModelId);

                if (model == null)
                {
                    throw new Exception($"Model with ID {data.ModelId} not found");
                }

                model.ModelCode = data.ModelCode;
                model.ModelName = data.ModelName;
                model.Description = data.Description;

                await context.SaveChangesAsync();

                _logger.LogInformation($"Updated model: {model.ModelId}");
                Electron.IpcMain.Send(window, "model-updated", JsonSerializer.Serialize(model));
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error updating model: {ex.Message}");
                Electron.IpcMain.Send(window, "model-error", JsonSerializer.Serialize(new { error = ex.Message }));
            }
        });

        // Delete Model
        Electron.IpcMain.On("model-delete", async (args) =>
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            try
            {
                var id = JsonSerializer.Deserialize<int>(args.ToString());
                var model = await context.Models.FindAsync(id);

                if (model == null)
                {
                    throw new Exception($"Model with ID {id} not found");
                }

                context.Models.Remove(model);
                await context.SaveChangesAsync();

                _logger.LogInformation($"Deleted model: {id}");
                Electron.IpcMain.Send(window, "model-deleted", JsonSerializer.Serialize(new { success = true, id = id }));
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error deleting model: {ex.Message}");
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

public class ModelCreateRequest
{
    public string ModelCode { get; set; } = string.Empty;
    public string ModelName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? CreatedAt { get; set; }
    public int TotalProducts { get; set; }
    public List<SpecificationRequest>? Specifications { get; set; }
}

public class ModelUpdateRequest
{
    public int ModelId { get; set; }
    public string ModelCode { get; set; } = string.Empty;
    public string ModelName { get; set; } = string.Empty;
    public string? Description { get; set; }
}

public class SpecificationRequest
{
    public int ModelId { get; set; }  // Add this line
    public string SpecName { get; set; } = string.Empty;
    public double MinValue { get; set; }
    public double MaxValue { get; set; }
    public string? Unit { get; set; }
    public int DisplayOrder { get; set; }
}

// Add these classes at the bottom of your file
public class GetSpecsRequest
{
    public int ModelId { get; set; }
}

public class SpecificationUpdateRequest
{
    public int SpecId { get; set; }
    public int ModelId { get; set; }
    public string SpecName { get; set; } = string.Empty;
    public double MinValue { get; set; }
    public double MaxValue { get; set; }
    public string? Unit { get; set; }
    public int DisplayOrder { get; set; }
}

// Add this DTO class at the bottom of your file
public class ModelDTO
{
    public int ModelId { get; set; }
    public string ModelCode { get; set; } = string.Empty;
    public string ModelName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateTime CreatedAt { get; set; }
    public int TotalProducts { get; set; }
    public List<SpecificationDTO> Specifications { get; set; } = new();
}

public class SpecificationDTO
{
    public int SpecId { get; set; }
    public int ModelId { get; set; }
    public string SpecName { get; set; } = string.Empty;
    public double MinValue { get; set; }
    public double MaxValue { get; set; }
    public string? Unit { get; set; }
    public int DisplayOrder { get; set; }
}