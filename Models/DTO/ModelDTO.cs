namespace Models.DTO
{
    public class ModelDTO
    {
        public int ModelId { get; set; }
        public string PartNo { get; set; } = string.Empty;
        public string PartName { get; set; } = string.Empty;
        public string Material { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public DateTime ProductDate { get; set; }
        public string? WO { get; set; }
        public string? Machine { get; set; }
        public List<ImageDTO> Images { get; set; } = new List<ImageDTO>();
        public List<SpecificationDTO> Specifications { get; set; } = new List<SpecificationDTO>();
        public List<ModelDocumentDTO> Documents { get; set; } = new List<ModelDocumentDTO>();
    }
} 