public class DatabaseConfig
{
    public string Server { get; set; } = string.Empty;
    public string Database { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public bool IntegratedSecurity { get; set; }

    public string BuildConnectionString()
    {
        if (IntegratedSecurity)
        {
            return $"Server={Server};Database={Database};Trusted_Connection=True;TrustServerCertificate=True;";
        }
        return $"Server={Server};Database={Database};User Id={Username};Password={Password};TrustServerCertificate=True;";
    }
} 