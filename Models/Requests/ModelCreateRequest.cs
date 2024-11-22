namespace Models.Requests
{
    public class ModelCreateRequest
    {
        public string PartNo { get; set; } = string.Empty;
        public string PartName { get; set; } = string.Empty;
        public string? Material { get; set; }
        public DateTime? ProductDate { get; set; }
        public string? WO { get; set; }
        public string? Machine { get; set; }
        public List<SpecificationRequest>? Specifications { get; set; }
    }
} 