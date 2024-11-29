using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Models
{
    public class ModelDocument
    {
        [Key]
        public int DocumentId { get; set; }

        [Required]
        [StringLength(255)]
        public string FileName { get; set; } = string.Empty;

        [Required]
        public int ModelId { get; set; }

        [Required]
        public DateTime UploadDate { get; set; } = DateTime.Now;

        public long FileSize { get; set; }

        [StringLength(255)]
        public string OriginalName { get; set; } = string.Empty;

        [ForeignKey("ModelId")]
        public virtual Model Model { get; set; } = null!;
    }
} 