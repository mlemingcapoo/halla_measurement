using System;
using System.Collections.Generic;

namespace Models
{
    public class Product
    {
        public int ProductId { get; set; }
        public int ModelId { get; set; }
        public DateTime MeasurementDate { get; set; }
        public string Status { get; set; } = "Pending"; // Pending, Pass, Fail

        // Navigation properties
        public virtual Model Model { get; set; } = null!;
        public virtual ICollection<Measurement> Measurements { get; set; } = new List<Measurement>();
    }
} 