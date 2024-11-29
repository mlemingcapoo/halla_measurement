namespace Models.DTO
{
    public class UserDTO
    {
        public int UserId { get; set; }
        public string Username { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public string RoleType { get; set; } = string.Empty;
        public bool IsActive { get; set; }
    }
} 