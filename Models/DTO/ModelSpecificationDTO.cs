namespace Models.DTO
{
    public class ModelSpecificationDTO
    {
        public int SpecId { get; set; }
        public int ModelId { get; set; }
        public string SpecName { get; set; } = string.Empty;
        public double MinValue { get; set; }
        public double MaxValue { get; set; }
        public string? Unit { get; set; }
        public int DisplayOrder { get; set; }
    }
} 