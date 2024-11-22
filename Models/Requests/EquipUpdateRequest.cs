namespace Models.Requests
{
    public class EquipUpdateRequest
    {
        public int EquipId { get; set; }
        public string EquipName { get; set; } = string.Empty;
    }
} 