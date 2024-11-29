namespace Models.DTO
{
    public class ActionHistoryDTO
    {
        public int ActionHistoryId { get; set; }
        public string TableName { get; set; } = string.Empty;
        public string ColumnName { get; set; } = string.Empty;
        public int RecordId { get; set; }
        public DateTime ModifiedAt { get; set; }
        public string? OldValue { get; set; }
        public string? NewValue { get; set; }
        public string ActionType { get; set; } = string.Empty;
        public int? UserId { get; set; }
        public string? UserName { get; set; }
    }
} 