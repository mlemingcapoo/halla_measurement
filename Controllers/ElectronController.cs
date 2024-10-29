using ElectronNET.API;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Models;
using Microsoft.Extensions.Logging;

public class ElectronController : Controller
{
    private readonly ApplicationDbContext _context;

    private readonly ILogger<ElectronController> _logger;

    public ElectronController(ApplicationDbContext context, ILogger<ElectronController> logger)
    {
        _context = context;
        _logger = logger;
    }

    public void SetupIPC(BrowserWindow window)
    {
        if (HybridSupport.IsElectronActive)
        {
            _logger.LogInformation("Electron is active, setting up IPC handlers...");
            
            Electron.IpcMain.On("test-channel", (args) =>
            {
                _logger.LogInformation("Received message on test-channel");
                try 
                {
                    var message = "Hello from C#!";
                    _logger.LogInformation($"Sending message: {message}");
                    Electron.IpcMain.Send(window, "test-response", message);
                    _logger.LogInformation("Message sent successfully");
                }
                catch (Exception ex)
                {
                    _logger.LogError($"Error in test-channel: {ex.Message}");
                    _logger.LogError($"Stack trace: {ex.StackTrace}");
                }
            });
        }
        else 
        {
            _logger.LogError("Electron is not active!");
        }
    }
} 