namespace Models.Requests
{
    public class ProductCreateRequest
    {
        public int ModelId { get; set; }
        public DateTime? MeasurementDate { get; set; }
        public string MoldNumber { get; set; } = string.Empty;
    }
} 