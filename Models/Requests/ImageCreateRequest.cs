namespace Models.Requests
{
    public class ImageCreateRequest
    {
        public int ModelId { get; set; }
        public string Base64Image { get; set; } = string.Empty;
        public string FileName { get; set; } = string.Empty;
        public string ContentType { get; set; } = string.Empty;
    }
} 