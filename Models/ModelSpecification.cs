using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Models
{
    public class ModelSpecification
    {
        [Key]
        public int SpecId { get; set; }

        [Required]
        public string SpecName { get; set; } = string.Empty;
        [Required]
        public string EquipName { get; set; } = string.Empty;
        public double? MinValue { get; set; }
        public double? MaxValue { get; set; }
        public string? Unit { get; set; }
        public int ModelId { get; set; }    
        [ForeignKey("ModelId")]
        public virtual Model Model { get; set; } = null!;
    }
} 