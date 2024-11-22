namespace Models.Requests
{
    public class ModelUpdateRequest
    {
        public int ModelId { get; set; }
        public string PartNo { get; set; } = string.Empty;
        public string PartName { get; set; } = string.Empty;
        public string? Material { get; set; }
        public DateTime ProductDate { get; set; }
        public string? WO { get; set; }
        public string? Machine { get; set; }
    }
} 