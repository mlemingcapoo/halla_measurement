using ElectronNET.API;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

public class ElectronController : Controller
{
    private readonly IEnumerable<IIPCService> _ipcServices;
    private readonly ILogger<ElectronController> _logger;
    private BrowserWindow? _mainWindow;

    public ElectronController(
        ILogger<ElectronController> logger, 
        IEnumerable<IIPCService> ipcServices)
    {
        _logger = logger;
        _ipcServices = ipcServices;
    }

    public async Task SetupIPC(BrowserWindow window)
    {
        if (!HybridSupport.IsElectronActive)
        {
            _logger.LogError("Electron is not active!");
            return;
        }

        _mainWindow = window;

        try
        {
            // Setup global error handler
            Electron.IpcMain.On("error", (args) =>
            {
                _logger.LogError($"Frontend error: {args}");
            });

            // Setup validation for incoming IPC calls
            SetupIPCValidation();

            // Register services
            await RegisterServices();
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error in IPC setup: {ex.Message}");
            throw;
        }
    }

    private void SetupIPCValidation()
    {
        // Wrap IPC handlers with validation
        Electron.IpcMain.On("*", (args) =>
        {
            if (args == null || string.IsNullOrEmpty(args.ToString()))
            {
                _logger.LogWarning("Received empty or null args");
                return;
            }
            // Continue processing
        });
    }

    private async Task RegisterServices()
    {
        if (_mainWindow == null)
        {
            throw new InvalidOperationException("Main window not initialized");
        }

        int servicesCount = 0;
        foreach (var service in _ipcServices)
        {
            try
            {
                service.RegisterEvents(_mainWindow);
                servicesCount++;
                _logger.LogInformation($"Registered IPC service: {service.GetType().Name}");
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error registering IPC events for {service.GetType().Name}: {ex.Message}");
                throw;
            }
        }
        _logger.LogInformation($"Successfully registered {servicesCount} IPC services");
    }
}