namespace Models.Requests
{
    public class DocumentCreateRequest
    {
        public int ModelId { get; set; }
        public string FileName { get; set; } = string.Empty;
        public string OriginalName { get; set; } = string.Empty;
        public long FileSize { get; set; }
    }
} 