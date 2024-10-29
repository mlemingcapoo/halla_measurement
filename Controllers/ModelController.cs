using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Models;

namespace halla_measurement_1.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ModelController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IWebHostEnvironment _environment;

        public ModelController(ApplicationDbContext context, IWebHostEnvironment environment)
        {
            _context = context;
            _environment = environment;
        }

        [HttpPost]
        public async Task<ActionResult<Model>> CreateModel([FromForm] ModelCreateDto modelDto)
        {
            var model = new Model
            {
                ModelCode = modelDto.ModelCode,
                ModelName = modelDto.ModelName,
                Description = modelDto.Description,
                CreatedAt = DateTime.Now
            };

            if (modelDto.Images != null && modelDto.Images.Any())
            {
                var imagesPaths = new List<string>();
                foreach (var image in modelDto.Images)
                {
                    var uniqueFileName = Guid.NewGuid().ToString() + "_" + image.FileName;
                    var uploadsFolder = Path.Combine(_environment.WebRootPath, "images", "models");
                    Directory.CreateDirectory(uploadsFolder);
                    var filePath = Path.Combine(uploadsFolder, uniqueFileName);
                    
                    using (var stream = new FileStream(filePath, FileMode.Create))
                    {
                        await image.CopyToAsync(stream);
                    }
                    imagesPaths.Add("/images/models/" + uniqueFileName);
                }
                model.ImagePath = string.Join(";", imagesPaths);
            }

            foreach (var spec in modelDto.Specifications)
            {
                model.Specifications.Add(new ModelSpecification
                {
                    SpecName = spec.Name,
                    MinValue = spec.MinValue,
                    MaxValue = spec.MaxValue,
                    Unit = spec.Unit,
                    DisplayOrder = spec.DisplayOrder
                });
            }

            _context.Models.Add(model);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetModel), new { id = model.ModelId }, model);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<Model>> GetModel(int id)
        {
            var model = await _context.Models
                .Include(m => m.Specifications)
                .FirstOrDefaultAsync(m => m.ModelId == id);

            if (model == null)
            {
                return NotFound();
            }

            return model;
        }

        [HttpPost("test")]
        public async Task<ActionResult<Model>> CreateTestModel()
        {
            var model = new Model
            {
                ModelCode = "HUB-23",
                ModelName = "Hub Test Model",
                Description = "Test description",
                CreatedAt = DateTime.Now,
                TotalProducts = 0
            };

            // Add some test specifications
            model.Specifications.Add(new ModelSpecification
            {
                SpecName = "TS1",
                MinValue = 70,
                MaxValue = 72,
                Unit = "mm",
                DisplayOrder = 1
            });

            model.Specifications.Add(new ModelSpecification
            {
                SpecName = "TS2",
                MinValue = 70,
                MaxValue = 72,
                Unit = "mm",
                DisplayOrder = 2
            });

            _context.Models.Add(model);
            await _context.SaveChangesAsync();

            return Ok(model);
        }

        [HttpGet("all")]
        public async Task<ActionResult<IEnumerable<Model>>> GetAllModels()
        {
            var models = await _context.Models
                .Include(m => m.Specifications)
                .ToListAsync();
            return Ok(models);
        }
    }

    public class ModelCreateDto
    {
        public string ModelCode { get; set; } = string.Empty;
        public string ModelName { get; set; } = string.Empty;
        public string? Description { get; set; }
        public List<IFormFile>? Images { get; set; }
        public List<SpecificationDto> Specifications { get; set; } = new();
    }

    public class SpecificationDto
    {
        public string Name { get; set; } = string.Empty;
        public double MinValue { get; set; }
        public double MaxValue { get; set; }
        public string? Unit { get; set; }
        public int DisplayOrder { get; set; }
    }
} 