using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace Models
{
    public class Model
    {
        [Key]
        public int ModelId { get; set; }
        [Required]
        public string PartNo { get; set; } = string.Empty;
        [Required]
        public string PartName { get; set; } = string.Empty;
        public string Material { get; set; } = string.Empty;
        [Required]
        public DateTime CreatedAt { get; set; } = DateTime.Now;
        public DateTime? ProductDate { get; set; }
        public string? WO { get; set; }
        public string? Machine { get; set; }
        public virtual ICollection<ModelSpecification> Specifications { get; set; } = new List<ModelSpecification>();
        public virtual ICollection<Product> Products { get; set; } = new List<Product>();
        public virtual ICollection<ModelImage> Images { get; set; } = new List<ModelImage>();
    }
} 