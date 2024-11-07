namespace Models;

public class Image
{
    public int ImageId { get; set; }
    public int ModelId { get; set; }
    // all nullable
    public string? FileName { get; set; }
    public string? FilePath { get; set; }
    public string? ContentType { get; set; }
    public long FileSize { get; set; }
    public DateTime UploadedAt { get; set; }
    public int DisplayOrder { get; set; }
    
    public virtual Model Model { get; set; }
}
