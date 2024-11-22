using System.ComponentModel.DataAnnotations;

namespace Models
{
    public class Equip
    {
        [Key]
        public int EquipId { get; set; }

        [Required(ErrorMessage = "Equipment name is required")]
        [StringLength(100, MinimumLength = 1, ErrorMessage = "Equipment name must be between 1 and 100 characters")]
        public string EquipName { get; set; } = string.Empty;
    }
} 