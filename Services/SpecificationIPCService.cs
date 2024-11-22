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
    public class SpecificationIPCService : IIPCService
    {
        private readonly ILogger<SpecificationIPCService> _logger;
        private readonly IServiceScopeFactory _scopeFactory;

        public SpecificationIPCService(
            ILogger<SpecificationIPCService> logger,
            IServiceScopeFactory scopeFactory)
        {
            _logger = logger;
            _scopeFactory = scopeFactory;
        }

        public void RegisterEvents(BrowserWindow window)
        {
            RegisterCreateSpecification(window);
            RegisterGetSpecificationById(window);
            RegisterGetAllSpecifications(window);
            RegisterUpdateSpecification(window);
            RegisterDeleteSpecification(window);
        }

        private void RegisterCreateSpecification(BrowserWindow window)
        {
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
                        EquipName = data.EquipName,
                        MinValue = data.MinValue,
                        MaxValue = data.MaxValue,
                        Unit = data.Unit
                    };

                    context.ModelSpecifications.Add(spec);
                    await context.SaveChangesAsync();

                    var specDTO = new SpecificationDTO
                    {
                        SpecId = spec.SpecId,
                        ModelId = spec.ModelId,
                        SpecName = spec.SpecName,
                        EquipName = spec.EquipName,
                        MinValue = spec.MinValue ?? 0,
                        MaxValue = spec.MaxValue ?? 0,
                        Unit = spec.Unit
                    };

                    _logger.LogInformation($"Created specification: {spec.SpecId}");
                    Electron.IpcMain.Send(window, "spec-created", JsonSerializer.Serialize(specDTO, GetJsonSerializerOptions()));
                }
                catch (Exception ex)
                {
                    _logger.LogError($"Error creating specification: {ex.Message}");
                    Electron.IpcMain.Send(window, "spec-error", JsonSerializer.Serialize(new { error = ex.Message }));
                }
            });
        }

        private void RegisterGetSpecificationById(BrowserWindow window)
        {
            Electron.IpcMain.On("spec-getById", async (args) =>
            {
                using var scope = _scopeFactory.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                try
                {
                    var specId = JsonSerializer.Deserialize<int>(args.ToString());
                    var spec = await context.ModelSpecifications
                        .FirstOrDefaultAsync(s => s.SpecId == specId);

                    if (spec == null)
                    {
                        throw new Exception($"Specification with ID {specId} not found");
                    }

                    var specDTO = new SpecificationDTO
                    {
                        SpecId = spec.SpecId,
                        ModelId = spec.ModelId,
                        SpecName = spec.SpecName,
                        EquipName = spec.EquipName,
                        MinValue = spec.MinValue ?? 0,
                        MaxValue = spec.MaxValue ?? 0,
                        Unit = spec.Unit
                    };

                    _logger.LogInformation($"Retrieved specification: {specId}");
                    Electron.IpcMain.Send(window, "spec-detail", JsonSerializer.Serialize(specDTO));
                }
                catch (Exception ex)
                {
                    _logger.LogError($"Error getting specification: {ex.Message}");
                    Electron.IpcMain.Send(window, "spec-error", JsonSerializer.Serialize(new { error = ex.Message }));
                }
            });
        }

        private void RegisterGetAllSpecifications(BrowserWindow window)
        {
            Electron.IpcMain.On("spec-getAll", async (args) =>
            {
                using var scope = _scopeFactory.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                try
                {
                    _logger.LogInformation("Received spec-getAll request with args: " + args.ToString());
                    var request = JsonSerializer.Deserialize<GetSpecsRequest>(args.ToString(), GetJsonSerializerOptions());
                    if (request == null) throw new Exception("Invalid request");

                    var specs = await context.ModelSpecifications
                        .Where(s => s.ModelId == request.ModelId)
                        .ToListAsync();

                    var specDTOs = specs.Select(s => new SpecificationDTO
                    {
                        SpecId = s.SpecId,
                        ModelId = s.ModelId,
                        SpecName = s.SpecName,
                        EquipName = s.EquipName,
                        MinValue = s.MinValue ?? 0,
                        MaxValue = s.MaxValue ?? 0,
                        Unit = s.Unit
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
        }

        private void RegisterUpdateSpecification(BrowserWindow window)
        {
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
                    spec.EquipName = data.EquipName;
                    spec.MinValue = data.MinValue;
                    spec.MaxValue = data.MaxValue;
                    spec.Unit = data.Unit;

                    await context.SaveChangesAsync();

                    var specDTO = new SpecificationDTO
                    {
                        SpecId = spec.SpecId,
                        ModelId = spec.ModelId,
                        SpecName = spec.SpecName,
                        EquipName = spec.EquipName,
                        MinValue = spec.MinValue ?? 0,
                        MaxValue = spec.MaxValue ?? 0,
                        Unit = spec.Unit
                    };

                    _logger.LogInformation($"Updated specification: {spec.SpecId}");
                    Electron.IpcMain.Send(window, "spec-updated", JsonSerializer.Serialize(specDTO, GetJsonSerializerOptions()));
                }
                catch (Exception ex)
                {
                    _logger.LogError($"Error updating specification: {ex.Message}");
                    Electron.IpcMain.Send(window, "spec-error", JsonSerializer.Serialize(new { error = ex.Message }));
                }
            });
        }

        private void RegisterDeleteSpecification(BrowserWindow window)
        {
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