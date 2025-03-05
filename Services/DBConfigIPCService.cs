using ElectronNET.API;
using Microsoft.Extensions.Logging;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Data.SqlClient;

namespace Services
{
    public class DBConfigIPCService : IIPCService
    {
        private readonly ILogger<DBConfigIPCService> _logger;
        private const string ConfigFilePath = "config/database.config.json";

        public DBConfigIPCService(ILogger<DBConfigIPCService> logger)
        {
            _logger = logger;
            // Ensure config directory exists
            var configDir = Path.GetDirectoryName(ConfigFilePath);
            _logger.LogInformation("Checking database config directory: {path}", configDir);
            if (!Directory.Exists(configDir))
            {
                _logger.LogInformation("Database config directory not found, creating new one at: {path}", configDir);
                Directory.CreateDirectory(configDir);
            }

            // Check if file exists, create with default empty JSON if not
            if (!File.Exists(ConfigFilePath))
            {
                _logger.LogInformation("Database config file not found, creating new one at: {path}", ConfigFilePath);
                File.WriteAllText(ConfigFilePath, "{}");
            } else {
                _logger.LogInformation("Database config file found at: {path}", ConfigFilePath);
            }
        }

        private string BuildConnectionString(DatabaseConfigDto config)
        {
            var builder = new SqlConnectionStringBuilder
            {
                DataSource = config.Server,
                InitialCatalog = config.Database,
                UserID = config.Username,
                Password = config.Password,
                IntegratedSecurity = config.IntegratedSecurity,
                TrustServerCertificate = config.TrustServerCertificate,
                CommandTimeout = config.CommandTimeout
            };
            return builder.ConnectionString;
        }

        public void RegisterEvents(BrowserWindow window)
        {
            // Get database config
            Electron.IpcMain.On("dbconfig:get", async (args) =>
            {
                try
                {
                    var configJson = await File.ReadAllTextAsync(ConfigFilePath);
                    Electron.IpcMain.Send(window, "dbconfig:get-response", 
                        JsonSerializer.Serialize(new { success = true, config = configJson }));
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to get database config");
                    Electron.IpcMain.Send(window, "dbconfig:get-response", 
                        JsonSerializer.Serialize(new { success = false, message = ex.Message }));
                }
            });

            // Test connection
        Electron.IpcMain.On("dbconfig:test", async (args) =>
        {
            try
            {
                // make a call to the database connection service to test the connection
                // Test SQL Server database connection
                var configDto = JsonSerializer.Deserialize<DatabaseConfigDto>(args.ToString());
                using (var connection = new SqlConnection(BuildConnectionString(configDto)))
                {
                    await connection.OpenAsync();
                    _logger.LogInformation("Database connection test successful");
                }
                Electron.IpcMain.Send(window, "dbconfig:test-response", 
                    JsonSerializer.Serialize(new { success = true }));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to test database connection");
                Electron.IpcMain.Send(window, "dbconfig:test-response", 
                    JsonSerializer.Serialize(new { success = false, message = ex.Message }));
            }
        });

            // Update database config
            Electron.IpcMain.On("dbconfig:update", async (args) =>
            {
                try
                {
                    _logger.LogInformation("1. Updating database config: {config}", args.ToString());
                    var configDto = JsonSerializer.Deserialize<DatabaseConfigDto>(args.ToString());
                    _logger.LogInformation("2. Updating database config: {config}", configDto);
                    var configJson = JsonSerializer.Serialize(configDto);
                    _logger.LogInformation("3. Updating database config: {config}", configJson);
                    var wrapper = new { DatabaseConfig = configDto };
                    var outputJson = JsonSerializer.Serialize(wrapper);
                    _logger.LogInformation("4. Updating database config: {config}", outputJson);
                    await File.WriteAllTextAsync(ConfigFilePath, outputJson);
                    Electron.IpcMain.Send(window, "dbconfig:update-response", 
                        JsonSerializer.Serialize(new { success = true }));
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to update database config");
                    Electron.IpcMain.Send(window, "dbconfig:update-response", 
                        JsonSerializer.Serialize(new { success = false, message = ex.Message }));
                }
            });
        }
    }
}

public class DatabaseConfigDto
{
    public string Server { get; set; } = string.Empty;
    public string Database { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public bool IntegratedSecurity { get; set; } = false;
    public bool TrustServerCertificate { get; set; } = false;
    public int CommandTimeout { get; set; } = 30;

}

