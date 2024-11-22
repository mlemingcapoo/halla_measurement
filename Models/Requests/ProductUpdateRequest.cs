namespace Models.Requests
{
    public class ProductUpdateRequest
    {
        public int ProductId { get; set; }
        public DateTime? MeasurementDate { get; set; }
        public string MoldNumber { get; set; } = string.Empty;
    }
} 