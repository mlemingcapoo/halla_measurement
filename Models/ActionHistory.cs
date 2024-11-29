using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Models
{
    public class ActionHistory
    {
        [Key]
        public int ActionHistoryId { get; set; }
        
        [Required]
        public string TableName { get; set; } = string.Empty;
        
        [Required]
        public string ColumnName { get; set; } = string.Empty;
        
        [Required]
        public int RecordId { get; set; }
        
        [Required]
        public DateTime ModifiedAt { get; set; } = DateTime.Now;
        
        public string? OldValue { get; set; }
        
        public string? NewValue { get; set; }
        
        [Required]
        public string ActionType { get; set; } = string.Empty; // CREATE, UPDATE, DELETE
        
        public int? UserId { get; set; } // Changed from UserName to UserId
        
        [ForeignKey("UserId")]
        public virtual User? User { get; set; } // Add navigation property
    }
}
