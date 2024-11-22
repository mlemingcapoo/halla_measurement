using Microsoft.Extensions.Logging;
using ElectronNET.API;
using ElectronNET.API.Entities;

namespace Services
{
    // AppIPCService is a name can be changed to anything
    public class AppIPCService : IIPCService
    {
        // change AppIPCService to any name
        private readonly ILogger<AppIPCService> _logger;
        private readonly ComPortService _comPortService;

        public AppIPCService(ILogger<AppIPCService> logger, ComPortService comPortService)
        {
            _logger = logger;
            _comPortService = comPortService;
        }

        public void RegisterEvents(BrowserWindow window)
        {
            Electron.IpcMain.On("close-app", async (args) =>
            {
                _logger.LogInformation("Closing app");
                await _comPortService.DisconnectAsync();
                Electron.App.Exit(0);
            });
        }
    }
} 