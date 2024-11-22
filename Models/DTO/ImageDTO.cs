namespace Models.DTO
{
    public class ImageDTO
    {
        public int ImageId { get; set; }
        public int ModelId { get; set; }
        public string FileName { get; set; } = string.Empty;
        public string Base64Data { get; set; } = string.Empty;
        public string ContentType { get; set; } = string.Empty;
    }
} 