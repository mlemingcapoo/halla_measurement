using ElectronNET.API;
using ElectronNET.API.Entities;

var builder = WebApplication.CreateBuilder(args);

// Register MVC services
builder.Services.AddControllersWithViews();

// Integrate Electron.NET into the WebHost
builder.WebHost.UseElectron(args);

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
        var window = await Electron.WindowManager.CreateWindowAsync(new BrowserWindowOptions
        {
            Width = 800,
            Height = 600,
            Show = false // Initially hide the window
        });

        // Show the window once it's ready to prevent flickering
        window.OnReadyToShow += () => window.Show();

        // Close the application when the window is closed
        window.OnClosed += () => Electron.App.Quit();

        // Load the main page from the wwwroot folder
        window.LoadURL($"file://{System.IO.Path.Combine(app.Environment.ContentRootPath, "wwwroot/index.html")}");
    });
}

app.Run();
