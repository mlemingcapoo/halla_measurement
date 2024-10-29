using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace Models
{
    public class Model
    {
        [Key]
        public int ModelId { get; set; }
        public string ModelCode { get; set; } = string.Empty;
        public string ModelName { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string? ImagePath { get; set; }
        public DateTime CreatedAt { get; set; }
        public int TotalProducts { get; set; }

        // Navigation properties
        public virtual ICollection<ModelSpecification> Specifications { get; set; } = new List<ModelSpecification>();
        public virtual ICollection<Product> Products { get; set; } = new List<Product>();
    }
} 