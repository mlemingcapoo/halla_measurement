namespace Models.Requests
{
    public class DocumentFilterRequest
    {
        public int? ModelId { get; set; }
        public string? FileName { get; set; }
        public DateTime? FromDate { get; set; }
        public DateTime? ToDate { get; set; }
    }
} 