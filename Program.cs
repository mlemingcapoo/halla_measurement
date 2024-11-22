using ElectronNET.API;
using ElectronNET.API.Entities;
using Microsoft.EntityFrameworkCore;
using Services;
using System.Text.Json;
using System.Threading.Tasks;
using Models;

// Add mutex at the start
// using var mutex = new Mutex(true, "HallaMeasurementAppSingleInstance", out bool createdNew);

// if (!createdNew)
// {
//     if (HybridSupport.IsElectronActive)
//     {
//         try
//         {
//             await ShowDatabaseErrorNotification("Ứng dụng đang chạy ở một cửa sổ khác.");
//             Electron.App.Exit(0); // Use Exit instead of Quit
//         }
//         catch
//         {
//             Environment.Exit(0); // Force exit if Electron call fails
//         }
//     }
//     return;
// }

// // Add this to ensure cleanup on application exit
// AppDomain.CurrentDomain.ProcessExit += (s, e) =>
// {
//     mutex?.ReleaseMutex();
//     mutex?.Dispose();
// };



var builder = WebApplication.CreateBuilder(args);

// Add configuration sources
builder.Configuration
    .SetBasePath(builder.Environment.ContentRootPath)
    .AddJsonFile("appsettings.json", optional: false, reloadOnChange: true)
    .AddJsonFile($"appsettings.{builder.Environment.EnvironmentName}.json", optional: true, reloadOnChange: true)
    .AddJsonFile("config/database.config.json", optional: true, reloadOnChange: true);

// Only add user secrets in Development
if (builder.Environment.IsDevelopment())
{
    builder.Configuration.AddUserSecrets<Program>();
}

builder.Configuration.AddEnvironmentVariables();

// Configure Kestrel with port from manifest
builder.WebHost.ConfigureKestrel(serverOptions =>
{
    // Get port from manifest or use fallback
    var manifestPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "electron.manifest.json");
    int port = 8123; // Default fallback port

    if (File.Exists(manifestPath))
    {
        try
        {
            var manifestContent = File.ReadAllText(manifestPath);
            using (JsonDocument document = JsonDocument.Parse(manifestContent))
            {
                if (document.RootElement.TryGetProperty("ports", out JsonElement ports) &&
                    ports.TryGetProperty("http", out JsonElement httpPort))
                {
                    port = httpPort.GetInt32();
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error reading port from manifest: {ex.Message}");
        }
    }

    Console.WriteLine($"Configuring Kestrel to listen on port {port}");
    serverOptions.ListenLocalhost(port);
});

// Replace the SQLite configuration with SQL Server configuration
var databaseConfig = builder.Configuration.GetSection("DatabaseConfig").Get<DatabaseConfig>();
if (databaseConfig == null)
{
    throw new InvalidOperationException("Database configuration is missing");
}

builder.Services.AddDbContextFactory<ApplicationDbContext>(options =>
    options.UseSqlServer(databaseConfig.BuildConnectionString(), sqlOptions =>
    {
        sqlOptions.EnableRetryOnFailure(
            maxRetryCount: 3,
            maxRetryDelay: TimeSpan.FromSeconds(5),
            errorNumbersToAdd: null);
        sqlOptions.CommandTimeout(databaseConfig.CommandTimeout);
    }));

// Register MVC services
builder.Services.AddControllersWithViews();

// Add Electron IPC Service
builder.Services.AddElectron();

// Add ElectronController service registration
builder.Services.AddScoped<ElectronController>();

// place IPC event services here
builder.Services.AddScoped<IIPCService, AppIPCService>();
builder.Services.AddScoped<IIPCService, HardwareService>();
builder.Services.AddScoped<ComPortService>();
builder.Services.AddScoped<IIPCService, ModelIPCService>();
builder.Services.AddScoped<ExcelExportService>();
builder.Services.AddScoped<ExcelFileService>();
builder.Services.AddScoped<IIPCService, ExcelIPCService>();
builder.Services.AddScoped<ProductIPCService>();
builder.Services.AddScoped<IIPCService, ProductIPCService>();
builder.Services.AddScoped<IIPCService, SpecificationIPCService>();
builder.Services.AddScoped<IIPCService, MeasurementIPCService>();
builder.Services.AddScoped<IIPCService, EquipIPCService>();
builder.Services.AddScoped<IIPCService, ImageIPCService>();

// Add health checks
builder.Services.AddHealthChecks();

// Integrate Electron.NET into the WebHost
builder.WebHost.UseElectron(args);

builder.Logging.ClearProviders();
builder.Logging.AddConsole(); // Enable console logging
builder.Logging.AddDebug();

var app = builder.Build();

// Initialize database and create tables
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    try
    {
        Console.WriteLine("Attempting database initialization and migration...");
        dbContext.Database.Migrate();
        Console.WriteLine("Database initialization and migration completed successfully.");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Có lỗi khi kết nối với cơ sở dữ liệu: {ex.Message}");
        // Log the full exception details
        Console.WriteLine($"Exception details: {ex}");
        // display notification to the user
        await ShowDatabaseErrorNotification(ex.Message);
        // Attempt to ensure database is created even if migrations fail
        try
        {
            Console.WriteLine("Attempting to ensure database is created...");
            dbContext.Database.EnsureCreated();
            Console.WriteLine("Database creation completed.");
        }
        catch (Exception createEx)
        {
            Console.WriteLine($"Failed to create database: {createEx.Message}");
            await ShowDatabaseErrorNotification(createEx.Message);
            throw; // Re-throw if we can't even create the database
        }
    }
}

async Task ShowDatabaseErrorNotification(string message)
{
    await Electron.Dialog.ShowMessageBoxAsync(new MessageBoxOptions(message)
    {
        Type = MessageBoxType.error,
        Title = "Halla Measurement"
    });
}

// Configure the HTTP request pipeline for production
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();  // Apply HSTS for added security in production
}

app.UseHttpsRedirection();
app.UseStaticFiles();

app.UseRouting();
app.UseAuthorization();

// Define default route (though it's not needed for single-page setup)
// app.MapControllerRoute(
//     name: "default",
//     pattern: "{controller=Home}/{action=Index}/{id?}");

// Initialize Electron and load the main page
if (HybridSupport.IsElectronActive)
{
    app.Lifetime.ApplicationStarted.Register(async () =>
    {
        // Create loading window
        // var loadingWindow = await Electron.WindowManager.CreateWindowAsync(new BrowserWindowOptions
        // {
        //     Width = 400,
        //     Height = 400,
        //     Show = false,
        //     Frame = false,
        //     Transparent = true,
        //     Icon = Path.Combine(app.Environment.ContentRootPath, "wwwroot", "favicon.ico"),
        //     WebPreferences = new WebPreferences
        //     {
        //         NodeIntegration = false,
        //         ContextIsolation = true
        //     },
        // });
        // Check for single instance using Electron's mechanism
        var isSingleInstance = await Electron.App.RequestSingleInstanceLockAsync((args, workingDirectory) =>
        {
            // This callback will be called when subsequent instances are launched
        });
        if (!isSingleInstance)
        {
            Electron.App.Quit();
            return;
        }

        // Handle second instance attempts
        await Electron.App.On("second-instance", async (args) =>
        {
            var windows = Electron.WindowManager.BrowserWindows;
            var mainWindow = windows.FirstOrDefault();
            if (mainWindow != null)
            {
                if (await mainWindow.IsMinimizedAsync())
                {
                    mainWindow.Restore();
                }
                mainWindow.Focus();
            }
        });

        // Load the loading.html file
        // var loadingUrl = Path.Combine(app.Environment.ContentRootPath, "wwwroot", "loading.html");
        // loadingWindow.LoadURL(loadingUrl);
        // loadingWindow.Show();

        Console.WriteLine("Electron application starting...");

        // Create main window
        var window = await Electron.WindowManager.CreateWindowAsync(new BrowserWindowOptions
        {
            Width = 1280,
            Height = 720,
            Show = false,
            // Fullscreen = true,
            // Frame = false,
            Icon = Path.Combine(app.Environment.ContentRootPath, "wwwroot", "favicon.ico"),
            WebPreferences = new WebPreferences
            {
                NodeIntegration = false,
                ContextIsolation = true,
                Preload = Path.Combine(app.Environment.ContentRootPath, "wwwroot", "preload.js")
            },
            // Add these performance-related options
            AutoHideMenuBar = true,
            EnableLargerThanScreen = false,
            HasShadow = true,
            BackgroundColor = "#FFFFFF",  // Add this for white background
        });

        // loadingWindow.Close();
        // Show the window once it's ready to prevent flickering
        window.OnReadyToShow += () => window.Show();
        // Add these event handlers
        window.OnClose += async () =>
        {
            await CleanUpAsync();
        };
        

        try
        {
            Console.WriteLine("Setting up IPC...");
            using (var scope = app.Services.CreateScope())
            {
                var controller = scope.ServiceProvider.GetRequiredService<ElectronController>();
                controller.SetupIPC(window);
            }
            Console.WriteLine("IPC setup complete");

            // var url = $"http://localhost:8123/index.html";
            var url = Path.Combine(app.Environment.ContentRootPath, "wwwroot", "index.html");
            Console.WriteLine($"Loading URL: {url}");
            window.LoadURL(url);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error during startup: {ex.Message}");
            Console.WriteLine($"Stack trace: {ex.StackTrace}");
        }
    });
}

// Release mutex when application stops
// app.Lifetime.ApplicationStopping.Register(() =>
// {
//     mutex?.ReleaseMutex();
// });

// Add middleware to log all requests in development
if (app.Environment.IsDevelopment())
{
    app.Use(async (context, next) =>
    {
        Console.WriteLine($"Request: {context.Request.Method} {context.Request.Path}");
        await next();
        Console.WriteLine($"Response: {context.Response.StatusCode}");
    });
}

if (!app.Environment.IsDevelopment())
{
    // Setup a basic web server for serving static files in production
    app.UseDefaultFiles();
    app.UseStaticFiles();

    // Add fallback route
    app.MapFallbackToFile("index.html");
}

async Task CleanUpAsync()
{
    Console.WriteLine("Cleaning up (async)...");
    try
    {
        using (var scope = app.Services.CreateScope())
        {
            var comPortService = scope.ServiceProvider.GetRequiredService<ComPortService>();
            await comPortService.DisconnectAsync();
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Error during async cleanup: {ex.Message}");
    }
}

await app.RunAsync();
