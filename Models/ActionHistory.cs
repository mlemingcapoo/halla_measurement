using System.ComponentModel.DataAnnotations;

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
        
        public string? UserName { get; set; } // Optional: if you want to track who made the change
    }
}
