using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
namespace Models
{
    public class Product
    {
        [Key]
        public int ProductId { get; set; }
        [Required]
        public int ModelId { get; set; }
        [Required]
        public DateTime MeasurementDate { get; set; }
        [Required]
        public string MoldNumber { get; set; } = string.Empty;
        [ForeignKey("ModelId")]
        public virtual Model Model { get; set; } = null!;
        public virtual ICollection<Measurement> Measurements { get; set; } = new List<Measurement>();
    }
} 