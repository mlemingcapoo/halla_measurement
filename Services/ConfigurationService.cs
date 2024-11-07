using System;
using System.IO;
using System.Text.Json;
using Models;

public class ConfigurationService
{
    private readonly string _configPath;
    private static readonly JsonSerializerOptions _jsonOptions = new()
    {
        WriteIndented = true
    };

    public ConfigurationService()
    {
        var appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        var configDir = Path.Combine(appData, "HallaMeasurement");
        Directory.CreateDirectory(configDir);
        _configPath = Path.Combine(configDir, "dbconfig.json");
    }

    public async Task SaveDatabaseConfigAsync(DatabaseConfig config)
    {
        var json = JsonSerializer.Serialize(config, _jsonOptions);
        await File.WriteAllTextAsync(_configPath, json);
    }

    public async Task<DatabaseConfig?> LoadDatabaseConfigAsync()
    {
        if (!File.Exists(_configPath))
            return null;

        var json = await File.ReadAllTextAsync(_configPath);
        return JsonSerializer.Deserialize<DatabaseConfig>(json);
    }
} 