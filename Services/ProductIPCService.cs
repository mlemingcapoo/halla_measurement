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
    public class ProductIPCService : IIPCService
    {
        private readonly ILogger<ProductIPCService> _logger;
        private readonly IServiceScopeFactory _scopeFactory;

        public ProductIPCService(
            ILogger<ProductIPCService> logger,
            IServiceScopeFactory scopeFactory)
        {
            _logger = logger;
            _scopeFactory = scopeFactory;
        }

        public void RegisterEvents(BrowserWindow window)
        {
            RegisterCreateProduct(window);
            RegisterGetAllProducts(window);
            RegisterGetProductsByModel(window);
            RegisterGetProductsByModelAndMold(window);
            RegisterGetMoldsByModel(window);
            RegisterUpdateProductStatus(window);
            RegisterDeleteProduct(window);
        }

        public async Task<List<Product>> GetProductsByModelId(int modelId)
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            return await context.Products
                .Include(p => p.Model)
                .Include(p => p.Measurements)
                    .ThenInclude(m => m.Specification)
                .Where(p => p.ModelId == modelId)
                .ToListAsync();
        }

        private void RegisterCreateProduct(BrowserWindow window)
        {
            Electron.IpcMain.On("product-create", async (args) =>
            {
                using var scope = _scopeFactory.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                try
                {
                    _logger.LogInformation("Product data received: " + args.ToString());
                    var data = JsonSerializer.Deserialize<ProductCreateRequest>(args.ToString(), GetJsonSerializerOptions());

                    if (data == null) throw new Exception("Invalid product data");

                    var model = await context.Models.FindAsync(data.ModelId);
                    if (model == null)
                    {
                        throw new Exception($"Model with ID {data.ModelId} not found");
                    }

                    var product = new Product
                    {
                        ModelId = data.ModelId,
                        MeasurementDate = data.MeasurementDate ?? DateTime.Now,
                        MoldNumber = data.MoldNumber
                    };

                    context.Products.Add(product);
                    await context.SaveChangesAsync();

                    var productDTO = await CreateProductDTO(context, product);
                    _logger.LogInformation($"Created product: {product.ProductId}");
                    Electron.IpcMain.Send(window, "product-created", JsonSerializer.Serialize(productDTO, GetJsonSerializerOptions()));
                }
                catch (Exception ex)
                {
                    _logger.LogError($"Error creating product: {ex.Message}");
                    Electron.IpcMain.Send(window, "product-error", JsonSerializer.Serialize(new { error = ex.Message }));
                }
            });
        }

        private void RegisterGetAllProducts(BrowserWindow window)
        {
            Electron.IpcMain.On("product-getAll", async (args) =>
            {
                using var scope = _scopeFactory.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                try {
                    var products = await context.Products
                        .Include(p => p.Model)
                        .Include(p => p.Measurements)
                            .ThenInclude(m => m.Specification)
                        .Select(p => new ProductDTO
                        {
                            ProductId = p.ProductId,
                            ModelId = p.ModelId,
                            MeasurementDate = p.MeasurementDate,
                            MoldNumber = p.MoldNumber,
                            PartNo = p.Model.PartNo,
                            PartName = p.Model.PartName,
                            Measurements = p.Measurements.Select(m => new MeasurementDTO
                            {
                                MeasurementId = m.MeasurementId,
                                ProductId = m.ProductId,
                                SpecId = m.SpecId ?? 0,
                                Value = m.MeasuredValue,
                                MeasurementDate = m.MeasuredAt,
                                SpecName = m.Specification.SpecName,
                                MinValue = m.Specification.MinValue ?? 0,
                                MaxValue = m.Specification.MaxValue ?? 0,
                                Unit = m.Specification.Unit
                            }).ToList()
                        })
                        .ToListAsync();

                    _logger.LogInformation($"Retrieved products");
                    Electron.IpcMain.Send(window, "product-list", JsonSerializer.Serialize(products));
                }
                catch (Exception ex)
                {
                    _logger.LogError($"Error getting products: {ex.Message}");
                    Electron.IpcMain.Send(window, "product-error", JsonSerializer.Serialize(new { error = ex.Message }));
                }
            });
        }

        private void RegisterGetProductsByModel(BrowserWindow window)
        {
            Electron.IpcMain.On("product-getByModelId", async (args) =>
            {
                using var scope = _scopeFactory.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                try
                {
                    var modelId = JsonSerializer.Deserialize<int>(args.ToString());
                    var products = await context.Products
                        .Include(p => p.Model)
                        .Include(p => p.Measurements)
                            .ThenInclude(m => m.Specification)
                        .Where(p => p.ModelId == modelId)
                        .Select(p => new ProductDTO
                        {
                            ProductId = p.ProductId,
                            ModelId = p.ModelId,
                            MeasurementDate = p.MeasurementDate,
                            MoldNumber = p.MoldNumber,
                            PartNo = p.Model.PartNo,
                            PartName = p.Model.PartName,
                            Measurements = p.Measurements.Select(m => new MeasurementDTO
                            {
                                MeasurementId = m.MeasurementId,
                                ProductId = m.ProductId,
                                SpecId = m.SpecId ?? 0,
                                Value = m.MeasuredValue,
                                MeasurementDate = m.MeasuredAt,
                                SpecName = m.Specification.SpecName,
                                MinValue = m.Specification.MinValue ?? 0,
                                MaxValue = m.Specification.MaxValue ?? 0,
                                Unit = m.Specification.Unit
                            }).ToList()
                        })
                        .ToListAsync();

                    _logger.LogInformation($"Retrieved products");
                    Electron.IpcMain.Send(window, "product-list", JsonSerializer.Serialize(products));
                }
                catch (Exception ex)
                {
                    _logger.LogError($"Error getting products: {ex.Message}");
                    Electron.IpcMain.Send(window, "product-error", JsonSerializer.Serialize(new { error = ex.Message }));
                }
            });
        }

        private void RegisterGetProductsByModelAndMold(BrowserWindow window)
        {
            Electron.IpcMain.On("product-getByModelAndMold", async (args) =>
            {
                using var scope = _scopeFactory.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                try
                {
                    var request = JsonSerializer.Deserialize<ProductFilterRequest>(args.ToString());
                    var query = context.Products
                        .Include(p => p.Model)
                        .Include(p => p.Measurements)
                        .Where(p => p.ModelId == request.ModelId);

                    if (!string.IsNullOrEmpty(request.MoldNumber))
                    {
                        query = query.Where(p => p.MoldNumber == request.MoldNumber);
                    }

                    var products = await query.ToListAsync();
                    var productDTOs = await Task.WhenAll(products.Select(p => CreateProductDTO(context, p)));

                    _logger.LogInformation($"Retrieved {products.Count} products for model {request.ModelId} and mold {request.MoldNumber}");
                    Electron.IpcMain.Send(window, "product-list", JsonSerializer.Serialize(productDTOs, GetJsonSerializerOptions()));
                }
                catch (Exception ex)
                {
                    _logger.LogError($"Error getting products: {ex.Message}");
                    Electron.IpcMain.Send(window, "product-error", JsonSerializer.Serialize(new { error = ex.Message }));
                }
            });
        }

        private void RegisterGetMoldsByModel(BrowserWindow window)
        {
            Electron.IpcMain.On("molds-getByModel", async (args) =>
            {
                using var scope = _scopeFactory.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                try
                {
                    _logger.LogInformation($"📥 Received args: {args}");

                    var request = JsonSerializer.Deserialize<MoldRequest>(args.ToString(), 
                        new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                    
                    _logger.LogInformation($"📦 Deserialized request: {JsonSerializer.Serialize(request)}");

                    if (request == null)
                    {
                        throw new Exception("Invalid request data");
                    }

                    var molds = await context.Products
                        .Where(p => p.ModelId == request.ModelId)
                        .Select(p => p.MoldNumber)
                        .Where(m => !string.IsNullOrEmpty(m))
                        .Distinct()
                        .OrderBy(m => m)
                        .ToListAsync();

                    _logger.LogInformation($"📊 Retrieved {molds.Count} molds for model {request.ModelId}");
                    _logger.LogInformation($"🔍 Molds: {JsonSerializer.Serialize(molds)}");

                    var response = JsonSerializer.Serialize(molds);
                    _logger.LogInformation($"📤 Sending response: {response}");
                    
                    Electron.IpcMain.Send(window, "molds-list", response);
                }
                catch (Exception ex)
                {
                    _logger.LogError($"❌ Error getting molds: {ex.Message}");
                    _logger.LogError($"❌ Stack trace: {ex.StackTrace}");
                    _logger.LogError($"📥 Raw args received: {args}");
                    
                    var errorResponse = JsonSerializer.Serialize(new { error = ex.Message });
                    _logger.LogError($"📤 Sending error response: {errorResponse}");
                    
                    Electron.IpcMain.Send(window, "molds-error", errorResponse);
                }
            });
        }

        private void RegisterUpdateProductStatus(BrowserWindow window)
        {
            Electron.IpcMain.On("product-updateStatus", async (args) =>
            {
                using var scope = _scopeFactory.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                try
                {
                    var data = JsonSerializer.Deserialize<ProductUpdateRequest>(args.ToString(), GetJsonSerializerOptions());
                    if (data == null) throw new Exception("Invalid update data");

                    var product = await context.Products
                        .Include(p => p.Model)
                        .Include(p => p.Measurements)
                        .FirstOrDefaultAsync(p => p.ProductId == data.ProductId);

                    if (product == null)
                    {
                        throw new Exception($"Product with ID {data.ProductId} not found");
                    }

                    if (data.MeasurementDate.HasValue)
                        product.MeasurementDate = data.MeasurementDate.Value;
                    
                    product.MoldNumber = data.MoldNumber;

                    await context.SaveChangesAsync();

                    var productDTO = await CreateProductDTO(context, product);
                    _logger.LogInformation($"Updated product: {product.ProductId}");
                    Electron.IpcMain.Send(window, "product-updated", JsonSerializer.Serialize(productDTO, GetJsonSerializerOptions()));
                }
                catch (Exception ex)
                {
                    _logger.LogError($"Error updating product: {ex.Message}");
                    Electron.IpcMain.Send(window, "product-error", JsonSerializer.Serialize(new { error = ex.Message }));
                }
            });
        }

        private void RegisterDeleteProduct(BrowserWindow window)
        {
            Electron.IpcMain.On("product-delete", async (args) =>
            {
                using var scope = _scopeFactory.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                try
                {
                    var productId = JsonSerializer.Deserialize<int>(args.ToString());
                    var product = await context.Products
                        .Include(p => p.Model)
                        .FirstOrDefaultAsync(p => p.ProductId == productId);

                    if (product == null)
                    {
                        throw new Exception($"Product with ID {productId} not found");
                    }

                    var model = product.Model;
                    context.Products.Remove(product);
                    await context.SaveChangesAsync();

                    // Update TotalProducts count
                    // model.TotalProducts = Math.Max(0, model.TotalProducts - 1);
                    await context.SaveChangesAsync();

                    _logger.LogInformation($"Deleted product: {productId}");
                    Electron.IpcMain.Send(window, "product-deleted", JsonSerializer.Serialize(new { success = true, id = productId }));
                }
                catch (Exception ex)
                {
                    _logger.LogError($"Error deleting product: {ex.Message}");
                    Electron.IpcMain.Send(window, "product-error", JsonSerializer.Serialize(new { error = ex.Message }));
                }
            });
        }

        private async Task<ProductDTO> CreateProductDTO(ApplicationDbContext context, Product product)
        {
            var measurements = await context.Measurements
                .Where(m => m.ProductId == product.ProductId)
                .Join(context.ModelSpecifications,
                    m => m.SpecId,
                    s => s.SpecId,
                    (m, s) => new MeasurementDTO
                    {
                        MeasurementId = m.MeasurementId,
                        ProductId = m.ProductId,
                        SpecId = m.SpecId ?? 0,
                        Value = m.MeasuredValue,
                        MeasurementDate = m.MeasuredAt,
                        SpecName = s.SpecName,
                        MinValue = s.MinValue ?? 0,
                        MaxValue = s.MaxValue ?? 0,
                        Unit = s.Unit,
                        // IsWithinSpec = m.IsWithinSpec
                    })
                .ToListAsync();

            return new ProductDTO
            {
                ProductId = product.ProductId,
                ModelId = product.ModelId,
                MeasurementDate = product.MeasurementDate,
                MoldNumber = product.MoldNumber,
                PartNo = product.Model.PartNo,
                PartName = product.Model.PartName,
                Measurements = measurements
            };
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