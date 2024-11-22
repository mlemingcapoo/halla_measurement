namespace Models.DTO
{
    public class MeasurementDTO
    {
        public int MeasurementId { get; set; }
        public int ProductId { get; set; }
        public int SpecId { get; set; }
        public double Value { get; set; }
        public DateTime MeasurementDate { get; set; }
        public string SpecName { get; set; } = string.Empty;
        public double MinValue { get; set; }
        public double MaxValue { get; set; }
        public string? Unit { get; set; }
        public bool IsWithinSpec => Value >= MinValue && Value <= MaxValue;
        public string ModelCode { get; set; } = string.Empty;
    }
} 