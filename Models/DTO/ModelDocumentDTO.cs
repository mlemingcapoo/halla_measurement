namespace Models.DTO
{
    public class ModelDocumentDTO
    {
        public int DocumentId { get; set; }
        public string FileName { get; set; } = string.Empty;
        public int ModelId { get; set; }
        public DateTime UploadDate { get; set; }
        public long FileSize { get; set; }
        public string OriginalName { get; set; } = string.Empty;
    }
} 