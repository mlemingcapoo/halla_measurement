namespace Models.Requests
{
    public class MeasurementCreateRequest
    {
        public int ProductId { get; set; }
        public int SpecId { get; set; }
        public double Value { get; set; }
        public DateTime? MeasurementDate { get; set; }
    }
} 