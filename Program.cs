using ElectronNET.API;
using ElectronNET.API.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using System.Text.Json;
using System.Threading.Tasks;

// Add mutex at the start
using var mutex = new Mutex(true, "HallaMeasurementAppSingleInstance", out bool createdNew);

if (!createdNew)
{
    if (HybridSupport.IsElectronActive)
    {
        await ShowDatabaseErrorNotification("Ứng dụng đang chạy ở một cửa sổ khác.");
        Electron.App.Quit();
    }
    return;
}



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

// Update the database configuration
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(connectionString),
    ServiceLifetime.Scoped);

// Register MVC services
builder.Services.AddControllersWithViews();

// Add Electron IPC Service
builder.Services.AddElectron();

// Add ElectronController service registration
builder.Services.AddScoped<ElectronController>();

// Add health checks
builder.Services.AddHealthChecks();

// Integrate Electron.NET into the WebHost
builder.WebHost.UseElectron(args);

builder.Logging.ClearProviders();
builder.Logging.AddConsole(); // Enable console logging
builder.Logging.AddDebug();

var app = builder.Build();

async Task<BrowserWindow> CreateLoadingWindow()
{
    var loadingWindow = await Electron.WindowManager.CreateWindowAsync(new BrowserWindowOptions
    {
        Width = 350,
        Height = 350,
        Show = false,
        Frame = false,
        Transparent = true,
        WebPreferences = new WebPreferences
        {
            NodeIntegration = false,
            ContextIsolation = true
        },
        AutoHideMenuBar = true,
        HasShadow = false
    });

    // Load the loading screen HTML
    loadingWindow.LoadURL(Path.Combine(app.Environment.ContentRootPath, "wwwroot", "loading.html"));
    loadingWindow.Show();
    return loadingWindow;
}

// Move database initialization into a separate function
async Task InitializeDatabase()
{
    using (var scope = app.Services.CreateScope())
    {
        var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        Console.WriteLine("Attempting database initialization and migration...");
        await dbContext.Database.MigrateAsync();
        Console.WriteLine("Database initialization and migration completed successfully.");
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
        try
        {
            // Create and show loading window first
            var loadingWindow = await CreateLoadingWindow();
    
            try
            {
                // Initialize database
                await InitializeDatabase();

                // Create main window
                var window = await Electron.WindowManager.CreateWindowAsync(new BrowserWindowOptions
                {
                    Width = 1280,
                    Height = 720,
                    Show = false,
                    Icon = Path.Combine(app.Environment.ContentRootPath, "wwwroot", "favicon.ico"),
                    WebPreferences = new WebPreferences
                    {
                        NodeIntegration = false,
                        ContextIsolation = true,
                        Preload = Path.Combine(app.Environment.ContentRootPath, "wwwroot", "preload.js")
                    },
                    AutoHideMenuBar = true,
                    EnableLargerThanScreen = false,
                    HasShadow = false
                });

                // Setup IPC
                Console.WriteLine("Setting up IPC...");
                using (var scope = app.Services.CreateScope())
                {
                    var controller = scope.ServiceProvider.GetRequiredService<ElectronController>();
                    controller.SetupIPC(window);
                }

                // Load main window URL
                var url = Path.Combine(app.Environment.ContentRootPath, "wwwroot", "index.html");
                Console.WriteLine($"Loading URL: {url}");
                window.LoadURL(url);

                // When main window is ready
                window.OnReadyToShow += () =>
                {
                    window.Show();
                    loadingWindow.Close();
                };

                // Add quit event to main window instead
                window.OnClosed += () => Electron.App.Quit();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error during startup: {ex.Message}");
                // Add quit event to loading window only if we encounter an error
                loadingWindow.OnClosed += () => Electron.App.Quit();
                await ShowDatabaseErrorNotification("Không thể kết nối tới cơ sở dữ liệu. Vui lòng kiểm tra lại kết nối mạng, và mở lại ứng dụng.\n\nHoặc liên hệ với kỹ thuật viên để được hỗ trợ.\n\n" + ex.Message);
                loadingWindow.Close();
                return;
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Critical error: {ex.Message}");
            await ShowDatabaseErrorNotification($"Lỗi không xác định, vui lòng kiểm tra lại kết nối mạng và mở lại ứng dụng.\n\n{ex.Message}");
            Electron.App.Quit();
        }
    });
}

// Release mutex when application stops
app.Lifetime.ApplicationStopping.Register(() =>
{
    mutex?.ReleaseMutex();
});

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

app.Run();
