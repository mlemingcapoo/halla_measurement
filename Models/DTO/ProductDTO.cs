namespace Models.DTO
{
    public class ProductDTO
    {
        public int ProductId { get; set; }
        public int ModelId { get; set; }
        public DateTime MeasurementDate { get; set; }
        public string MoldNumber { get; set; } = string.Empty;
        public string PartNo { get; set; } = string.Empty;
        public string PartName { get; set; } = string.Empty;
        public List<MeasurementDTO> Measurements { get; set; } = new();
    }
} 