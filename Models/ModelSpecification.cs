using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Models
{
    public class ModelSpecification
    {
        [Key]
        public int SpecId { get; set; }

        [ForeignKey("Model")]
        public int ModelId { get; set; }

        [Required]
        public string SpecName { get; set; } = string.Empty;

        [Required]
        public double MinValue { get; set; }

        [Required]
        public double MaxValue { get; set; }

        public string? Unit { get; set; }

        [Required]
        public int DisplayOrder { get; set; }

        // Navigation property
        public virtual Model Model { get; set; } = null!;
    }
} 