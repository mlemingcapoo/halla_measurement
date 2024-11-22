using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Models
{
    public class ModelImage
    {
        [Key]
        public int ImageId { get; set; }
        [Required]
        public string FileName { get; set; } = string.Empty;
        [Required]
        public string Base64Data { get; set; } = string.Empty;
        public string ContentType { get; set; } = string.Empty;
        public int ModelId { get; set; }
        [ForeignKey("ModelId")]
        public virtual Model Model { get; set; } = null!;
    }
}