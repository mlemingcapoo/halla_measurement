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
    public class EquipIPCService : IIPCService
    {
        private readonly ILogger<EquipIPCService> _logger;
        private readonly IServiceScopeFactory _scopeFactory;

        public EquipIPCService(
            ILogger<EquipIPCService> logger,
            IServiceScopeFactory scopeFactory)
        {
            _logger = logger;
            _scopeFactory = scopeFactory;
        }

        public void RegisterEvents(BrowserWindow window)
        {
            RegisterCreateEquip(window);
            RegisterGetAllEquips(window);
            RegisterGetEquipById(window);
            RegisterUpdateEquip(window);
            RegisterDeleteEquip(window);
        }

        private async Task CleanupEmptyEquipments(ApplicationDbContext context)
        {
            try
            {
                var emptyEquips = await context.Equips
                    .Where(e => string.IsNullOrWhiteSpace(e.EquipName))
                    .ToListAsync();

                if (emptyEquips.Any())
                {
                    _logger.LogInformation($"Found {emptyEquips.Count} empty equipment records to clean up");
                    context.Equips.RemoveRange(emptyEquips);
                    await context.SaveChangesAsync();
                    _logger.LogInformation("Empty equipment records cleaned up successfully");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error cleaning up empty equipments: {ex.Message}");
            }
        }

        private void RegisterCreateEquip(BrowserWindow window)
        {
            Electron.IpcMain.On("equip-create", async (args) =>
            {
                using var scope = _scopeFactory.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                try
                {
                    await CleanupEmptyEquipments(context);

                    _logger.LogInformation("⭐ Equipment data received: " + args);
                    var data = JsonSerializer.Deserialize<EquipCreateRequest>(args.ToString());
                    
                    _logger.LogInformation("⭐ Deserialized data: " + JsonSerializer.Serialize(data));

                    if (data == null || string.IsNullOrWhiteSpace(data.EquipName))
                    {
                        throw new Exception("Equipment name is required");
                    }

                    // Normalize the name for comparison (trim and convert to lowercase)
                    var normalizedName = data.EquipName.Trim().ToLower();

                    // Check if name already exists (case-insensitive)
                    var exists = await context.Equips.AnyAsync(e => 
                        e.EquipName.ToLower() == normalizedName);
                    if (exists)
                    {
                        throw new Exception($"Equipment with name '{data.EquipName}' already exists");
                    }

                    var equip = new Equip
                    {
                        EquipName = data.EquipName.Trim()
                    };

                    context.Equips.Add(equip);
                    await context.SaveChangesAsync();

                    var equipDTO = new EquipDTO
                    {
                        EquipId = equip.EquipId,
                        EquipName = equip.EquipName
                    };

                    _logger.LogInformation($"Created equipment: {equip.EquipId} - {equip.EquipName}");
                    Electron.IpcMain.Send(window, "equip-created", JsonSerializer.Serialize(equipDTO));
                }
                catch (Exception ex)
                {
                    _logger.LogError($"Error creating equipment: {ex.Message}");
                    Electron.IpcMain.Send(window, "equip-error", JsonSerializer.Serialize(new { error = ex.Message }));
                }
            });
        }

        private void RegisterGetAllEquips(BrowserWindow window)
        {
            Electron.IpcMain.On("equip-getAll", async (args) =>
            {
                using var scope = _scopeFactory.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                try
                {
                    var equips = await context.Equips.ToListAsync();
                    var equipDTOs = equips.Select(e => new EquipDTO
                    {
                        EquipId = e.EquipId,
                        EquipName = e.EquipName
                    }).ToList();

                    Electron.IpcMain.Send(window, "equip-list", JsonSerializer.Serialize(equipDTOs));
                }
                catch (Exception ex)
                {
                    _logger.LogError($"Error getting equipment list: {ex.Message}");
                    Electron.IpcMain.Send(window, "equip-error", JsonSerializer.Serialize(new { error = ex.Message }));
                }
            });
        }

        private void RegisterGetEquipById(BrowserWindow window)
        {
            Electron.IpcMain.On("equip-getById", async (args) =>
            {
                using var scope = _scopeFactory.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                try
                {
                    var id = JsonSerializer.Deserialize<int>(args.ToString());
                    var equip = await context.Equips.FindAsync(id);

                    if (equip == null)
                    {
                        throw new Exception($"Equipment with ID {id} not found");
                    }

                    var equipDTO = new EquipDTO
                    {
                        EquipId = equip.EquipId,
                        EquipName = equip.EquipName
                    };

                    Electron.IpcMain.Send(window, "equip-details", JsonSerializer.Serialize(equipDTO));
                }
                catch (Exception ex)
                {
                    _logger.LogError($"Error getting equipment: {ex.Message}");
                    Electron.IpcMain.Send(window, "equip-error", JsonSerializer.Serialize(new { error = ex.Message }));
                }
            });
        }

        private void RegisterUpdateEquip(BrowserWindow window)
        {
            Electron.IpcMain.On("equip-update", async (args) =>
            {
                using var scope = _scopeFactory.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                try
                {
                    var data = JsonSerializer.Deserialize<EquipUpdateRequest>(args.ToString());
                    if (data == null) throw new Exception("Invalid update data");

                    var equip = await context.Equips.FindAsync(data.EquipId);
                    if (equip == null)
                    {
                        throw new Exception($"Equipment with ID {data.EquipId} not found");
                    }

                    // Check if new name already exists (excluding current equipment)
                    var exists = await context.Equips
                        .AnyAsync(e => e.EquipName == data.EquipName && e.EquipId != data.EquipId);
                    if (exists)
                    {
                        throw new Exception($"Equipment with name {data.EquipName} already exists");
                    }

                    equip.EquipName = data.EquipName;
                    await context.SaveChangesAsync();

                    var equipDTO = new EquipDTO
                    {
                        EquipId = equip.EquipId,
                        EquipName = equip.EquipName
                    };

                    Electron.IpcMain.Send(window, "equip-updated", JsonSerializer.Serialize(equipDTO));
                }
                catch (Exception ex)
                {
                    _logger.LogError($"Error updating equipment: {ex.Message}");
                    Electron.IpcMain.Send(window, "equip-error", JsonSerializer.Serialize(new { error = ex.Message }));
                }
            });
        }

        private void RegisterDeleteEquip(BrowserWindow window)
        {
            Electron.IpcMain.On("equip-delete", async (args) =>
            {
                using var scope = _scopeFactory.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                try
                {
                    var id = JsonSerializer.Deserialize<int>(args.ToString());
                    var equip = await context.Equips.FindAsync(id);

                    if (equip == null)
                    {
                        throw new Exception($"Equipment with ID {id} not found");
                    }

                    // Find all specifications using this equipment and clear their EquipName
                    var specs = await context.ModelSpecifications
                        .Where(s => s.EquipName == equip.EquipName)
                        .ToListAsync();

                    foreach (var spec in specs)
                    {
                        spec.EquipName = string.Empty;
                    }

                    // Remove the equipment
                    context.Equips.Remove(equip);
                    await context.SaveChangesAsync();

                    await CleanupEmptyEquipments(context);

                    _logger.LogInformation($"Deleted equipment: {id} and cleared {specs.Count} specification references");
                    Electron.IpcMain.Send(window, "equip-deleted", JsonSerializer.Serialize(new { 
                        success = true, 
                        id,
                        affectedSpecs = specs.Select(s => s.SpecId).ToList() 
                    }));
                }
                catch (Exception ex)
                {
                    _logger.LogError($"Error deleting equipment: {ex.Message}");
                    Electron.IpcMain.Send(window, "equip-error", JsonSerializer.Serialize(new { error = ex.Message }));
                }
            });
        }
    }
} 