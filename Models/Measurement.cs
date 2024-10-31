using System.ComponentModel.DataAnnotations.Schema;

namespace Models
{
    public class Measurement
    {
        public int MeasurementId { get; set; }
        public int ProductId { get; set; }
        public int SpecId { get; set; }
        public double MeasuredValue { get; set; }
        public bool IsWithinSpec { get; set; }
        public DateTime MeasuredAt { get; set; }

        // Navigation properties
        public virtual Product Product { get; set; } = null!;
        [ForeignKey("SpecId")]
        public virtual ModelSpecification Specification { get; set; } = null!;
    }
} 