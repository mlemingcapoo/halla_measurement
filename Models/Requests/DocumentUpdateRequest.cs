namespace Models.Requests
{
    public class DocumentUpdateRequest
    {
        public int DocumentId { get; set; }
        public string FileName { get; set; } = string.Empty;
        public string OriginalName { get; set; } = string.Empty;
    }
} 