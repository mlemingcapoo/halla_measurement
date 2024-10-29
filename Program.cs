using ElectronNET.API;
using ElectronNET.API.Entities;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Add SQLite database
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection") ?? "Data Source=measurements.db";
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlite(connectionString), 
    ServiceLifetime.Scoped);

// Register MVC services
builder.Services.AddControllersWithViews();

// Add Electron IPC Service
builder.Services.AddElectron();

// Add ElectronController service registration
builder.Services.AddScoped<ElectronController>();

// Integrate Electron.NET into the WebHost
builder.WebHost.UseElectron(args);

builder.Logging.ClearProviders();
builder.Logging.AddConsole(); // Enable console logging
builder.Logging.AddDebug();

var app = builder.Build();

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
        Console.WriteLine("Electron application starting...");
        var window = await Electron.WindowManager.CreateWindowAsync(new BrowserWindowOptions
        {
            Width = 800,
            Height = 600,
            Show = false,
            WebPreferences = new WebPreferences
            {
                NodeIntegration = false,
                ContextIsolation = true,
                Preload = Path.Combine(app.Environment.ContentRootPath, "wwwroot", "preload.js")
            }
        });

        // Show the window once it's ready to prevent flickering
        window.OnReadyToShow += () => window.Show();

        // Close the application when the window is closed
        window.OnClosed += () => Electron.App.Quit();

        try 
        {
            Console.WriteLine("Setting up IPC...");
            using (var scope = app.Services.CreateScope())
            {
                var controller = scope.ServiceProvider.GetRequiredService<ElectronController>();
                controller.SetupIPC(window);
            }
            Console.WriteLine("IPC setup complete");

            // Load the main page from the wwwroot folder
            Console.WriteLine("Loading main page...");
            window.LoadURL($"file://{System.IO.Path.Combine(app.Environment.ContentRootPath, "wwwroot/index.html")}");
            Console.WriteLine("Main page loaded");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error during startup: {ex.Message}");
            Console.WriteLine($"Stack trace: {ex.StackTrace}");
        }
    });
}

app.Run();
