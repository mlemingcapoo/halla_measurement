using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using halla_measurement_1.Models;
using Models;

[ApiController]
[Route("api/[controller]")]
public class MeasurementController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public MeasurementController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet("model/{modelCode}")]
    public async Task<ActionResult<IEnumerable<Product>>> GetMeasurementsByModel(string modelCode)
    {
        var products = await _context.Products
            .Include(p => p.Model)
            .Include(p => p.Measurements)
                .ThenInclude(m => m.Specification)
            .Where(p => p.Model.ModelCode == modelCode)
            .OrderByDescending(p => p.MeasurementDate)
            .Take(100)
            .ToListAsync();

        return Ok(products);
    }

    [HttpPost("product")]
    public async Task<ActionResult<Product>> CreateProductMeasurement(int modelId, List<MeasurementDto> measurements)
    {
        var product = new Product
        {
            ModelId = modelId,
            MeasurementDate = DateTime.Now
        };

        _context.Products.Add(product);
        await _context.SaveChangesAsync();

        foreach (var measurement in measurements)
        {
            var spec = await _context.ModelSpecifications
                .FirstOrDefaultAsync(s => s.ModelId == modelId && s.SpecName == measurement.SpecName);

            if (spec != null)
            {
                var isWithinSpec = measurement.Value >= spec.MinValue && measurement.Value <= spec.MaxValue;
                
                _context.Measurements.Add(new Measurement
                {
                    ProductId = product.ProductId,
                    SpecId = spec.SpecId,
                    MeasuredValue = measurement.Value,
                    IsWithinSpec = isWithinSpec,
                    MeasuredAt = DateTime.Now
                });
            }
        }

        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetMeasurementsByModel), new { modelCode = product.Model.ModelCode }, product);
    }
}

public class MeasurementDto
{
    public string SpecName { get; set; } = string.Empty;
    public double Value { get; set; }
} 