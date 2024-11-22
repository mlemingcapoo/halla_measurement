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
    public class MeasurementIPCService : IIPCService
    {
        private readonly ILogger<MeasurementIPCService> _logger;
        private readonly IServiceScopeFactory _scopeFactory;

        public MeasurementIPCService(
            ILogger<MeasurementIPCService> logger,
            IServiceScopeFactory scopeFactory)
        {
            _logger = logger;
            _scopeFactory = scopeFactory;
        }

        public void RegisterEvents(BrowserWindow window)
        {
            RegisterCreateMeasurement(window);
            RegisterGetMeasurementsByProduct(window);
            RegisterGetAllMeasurements(window);
            RegisterDeleteMeasurement(window);
        }

        private void RegisterCreateMeasurement(BrowserWindow window)
        {
            Electron.IpcMain.On("measurement-create", async (args) =>
            {
                using var scope = _scopeFactory.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                try
                {
                    _logger.LogInformation("Measurement data received: " + args.ToString());
                    var data = JsonSerializer.Deserialize<MeasurementCreateRequest>(args.ToString(), GetJsonSerializerOptions());

                    if (data == null) throw new Exception("Invalid measurement data");

                    // Add debugging
                    var allSpecs = await context.ModelSpecifications.ToListAsync();
                    _logger.LogInformation($"Available SpecIds: {string.Join(", ", allSpecs.Select(s => s.SpecId))}");
                    _logger.LogInformation($"Attempting to use SpecId: {data.SpecId}");

                    // Validate product exists
                    var product = await context.Products.FindAsync(data.ProductId);
                    if (product == null)
                    {
                        throw new Exception($"Product with ID {data.ProductId} not found");
                    }

                    // Validate specification exists
                    var spec = await context.ModelSpecifications.FindAsync(data.SpecId);
                    if (spec == null)
                    {
                        throw new Exception($"Specification with ID {data.SpecId} not found");
                    }

                    // Create new measurement
                    var measurement = new Measurement
                    {
                        ProductId = data.ProductId,
                        SpecId = data.SpecId,
                        MeasuredValue = data.Value,
                        MeasuredAt = data.MeasurementDate ?? DateTime.Now
                    };

                    context.Measurements.Add(measurement);
                    await context.SaveChangesAsync();

                    // Create DTO for response
                    var measurementDTO = new MeasurementDTO
                    {
                        MeasurementId = measurement.MeasurementId,
                        ProductId = measurement.ProductId,
                        SpecId = measurement.SpecId ?? 0,
                        Value = measurement.MeasuredValue,
                        MeasurementDate = measurement.MeasuredAt,
                        SpecName = spec.SpecName,
                        MinValue = spec.MinValue ?? 0,
                        MaxValue = spec.MaxValue ?? 0,
                        Unit = spec.Unit,
                        // IsWithinSpec = measurement.MeasuredValue >= spec.MinValue && measurement.MeasuredValue <= spec.MaxValue
                    };

                    _logger.LogInformation($"Created measurement: {measurement.MeasurementId}");
                    Electron.IpcMain.Send(window, "measurement-created", JsonSerializer.Serialize(measurementDTO, GetJsonSerializerOptions()));
                }
                catch (Exception ex)
                {
                    _logger.LogError($"Error creating measurement: {ex.Message}");
                    Electron.IpcMain.Send(window, "measurement-error", JsonSerializer.Serialize(new { error = ex.Message }));
                }
            });
        }

        private void RegisterGetMeasurementsByProduct(BrowserWindow window)
        {
            Electron.IpcMain.On("measurement-getByProduct", async (args) =>
            {
                using var scope = _scopeFactory.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                try
                {
                    var productId = JsonSerializer.Deserialize<int>(args.ToString());
                    _logger.LogInformation($"Fetching measurements for product {productId}");

                    var measurements = await context.Measurements
                        .AsNoTracking()
                        .Include(m => m.Specification)
                        .Include(m => m.Product)
                            .ThenInclude(p => p.Model)
                        .Where(m => m.ProductId == productId)
                        .Select(m => new MeasurementDTO
                        {
                            MeasurementId = m.MeasurementId,
                            ProductId = m.ProductId,
                            SpecId = m.SpecId ?? 0,
                            Value = m.MeasuredValue,
                            MeasurementDate = m.MeasuredAt,
                            SpecName = m.Specification.SpecName,
                            MinValue = m.Specification.MinValue ?? 0,
                            MaxValue = m.Specification.MaxValue ?? 0,
                            Unit = m.Specification.Unit,
                            // IsWithinSpec = m.MeasuredValue >= m.Specification.MinValue && m.MeasuredValue <= m.Specification.MaxValue,
                            ModelCode = m.Product.Model.PartNo
                        })
                        .ToListAsync();

                    _logger.LogInformation($"Found measurements for product {productId}");
                    Electron.IpcMain.Send(window, "measurement-list",
                        JsonSerializer.Serialize(measurements, GetJsonSerializerOptions()));
                }
                catch (Exception ex)
                {
                    _logger.LogError($"Error getting measurements for product {args}: {ex.Message}");
                    Electron.IpcMain.Send(window, "measurement-error",
                        JsonSerializer.Serialize(new { error = ex.Message }));
                }
            });
        }

        private void RegisterGetAllMeasurements(BrowserWindow window)
        {
            Electron.IpcMain.On("measurement-getAll", async (args) =>
            {
                using var scope = _scopeFactory.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                try
                {
                    var measurements = await context.Measurements
                        .AsNoTracking()
                        .Include(m => m.Product)
                            .ThenInclude(p => p.Model)
                        .Include(m => m.Specification)
                        .Select(m => new MeasurementDTO
                        {
                            MeasurementId = m.MeasurementId,
                            ProductId = m.ProductId,
                            SpecId = m.SpecId ?? 0,
                            Value = m.MeasuredValue,
                            MeasurementDate = m.MeasuredAt,
                            SpecName = m.Specification.SpecName,
                            MinValue = m.Specification.MinValue ?? 0,
                            MaxValue = m.Specification.MaxValue ?? 0,
                            Unit = m.Specification.Unit,
                            // IsWithinSpec = m.MeasuredValue >= m.Specification.MinValue && m.MeasuredValue <= m.Specification.MaxValue,
                            ModelCode = m.Product.Model.PartNo
                        })
                        .ToListAsync();

                    _logger.LogInformation($"Retrieved measurements");
                    Electron.IpcMain.Send(window, "measurement-list", JsonSerializer.Serialize(measurements, GetJsonSerializerOptions()));
                }
                catch (Exception ex)
                {
                    _logger.LogError($"Error getting measurements: {ex.Message}");
                    Electron.IpcMain.Send(window, "measurement-error", JsonSerializer.Serialize(new { error = ex.Message }));
                }
            });
        }

        private void RegisterDeleteMeasurement(BrowserWindow window)
        {
            Electron.IpcMain.On("measurement-delete", async (args) =>
            {
                using var scope = _scopeFactory.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                try
                {
                    var measurementId = JsonSerializer.Deserialize<int>(args.ToString());
                    var measurement = await context.Measurements.FindAsync(measurementId);

                    if (measurement == null)
                    {
                        throw new Exception($"Measurement with ID {measurementId} not found");
                    }

                    context.Measurements.Remove(measurement);
                    await context.SaveChangesAsync();

                    _logger.LogInformation($"Deleted measurement: {measurementId}");
                    Electron.IpcMain.Send(window, "measurement-deleted", JsonSerializer.Serialize(new { success = true, id = measurementId }));
                }
                catch (Exception ex)
                {
                    _logger.LogError($"Error deleting measurement: {ex.Message}");
                    Electron.IpcMain.Send(window, "measurement-error", JsonSerializer.Serialize(new { error = ex.Message }));
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