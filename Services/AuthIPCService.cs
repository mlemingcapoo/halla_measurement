using ElectronNET.API;
using ElectronNET.API.Entities;
using Microsoft.Extensions.Logging;
using Models;
using Models.DTO;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;

namespace Services
{
    public class AuthIPCService : IIPCService
    {
        private readonly ILogger<AuthIPCService> _logger;
        private readonly IDbContextFactory<ApplicationDbContext> _contextFactory;

        // Add static property for current user ID
        public static int? CurrentUserId { get; private set; }
        
        // Add static property to check if user is logged in
        public static bool IsLoggedIn => CurrentUserId.HasValue;

        public AuthIPCService(
            ILogger<AuthIPCService> logger,
            IDbContextFactory<ApplicationDbContext> contextFactory)
        {
            _logger = logger;
            _contextFactory = contextFactory;
        }

        public void RegisterEvents(BrowserWindow window)
        {
            // Handle login requests
            Electron.IpcMain.On("auth:login", async (args) =>
            {
                try
                {
                    _logger.LogInformation("Login attempt received");
                    
                    // Get the JSON string from args
                    string jsonString = args.ToString();
                    _logger.LogInformation($"Raw login data: {jsonString}");

                    // Define JSON deserialization options
                    var options = new JsonSerializerOptions
                    {
                        PropertyNameCaseInsensitive = true
                    };

                    // Deserialize the login request
                    var loginRequest = JsonSerializer.Deserialize<LoginRequestDTO>(jsonString, options);
                    
                    if (loginRequest == null || string.IsNullOrWhiteSpace(loginRequest.Username))
                    {
                        throw new Exception("Invalid login request - missing username");
                    }

                    if (string.IsNullOrWhiteSpace(loginRequest.Password))
                    {
                        throw new Exception("Invalid login request - missing password");
                    }

                    _logger.LogInformation($"Attempting login for user: '{loginRequest.Username}'");

                    // Database authentication
                    var response = await ValidateCredentialsAsync(loginRequest);
                    _logger.LogInformation($"Login response: {JsonSerializer.Serialize(response)}");
                    
                    // Set the current user ID upon successful login
                    if (response.Success)
                    {
                        CurrentUserId = response.User.UserId;
                        _logger.LogInformation($"Set CurrentUserId to: {CurrentUserId}");
                    }
                    
                    // Send response back to renderer
                    Electron.IpcMain.Send(window, "auth:login-response", JsonSerializer.Serialize(response));
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Login failed");
                    // Clear CurrentUserId on login failure
                    CurrentUserId = null;
                    
                    var errorResponse = new LoginResponseDTO 
                    { 
                        Success = false,
                        Message = "Login failed: " + ex.Message
                    };
                    Electron.IpcMain.Send(window, "auth:login-response", JsonSerializer.Serialize(errorResponse));
                }
            });

            // Add logout handler
            Electron.IpcMain.On("auth:logout", (args) =>
            {
                try
                {
                    // Clear the current user ID
                    CurrentUserId = null;
                    _logger.LogInformation("User logged out successfully");
                    
                    // Send success response back to renderer
                    Electron.IpcMain.Send(window, "auth:logout-response", JsonSerializer.Serialize(new { Success = true }));
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Logout failed");
                    Electron.IpcMain.Send(window, "auth:logout-response", JsonSerializer.Serialize(new { Success = false, Message = ex.Message }));
                }
            });
        }

        private async Task<LoginResponseDTO> ValidateCredentialsAsync(LoginRequestDTO request)
        {
            using var context = await _contextFactory.CreateDbContextAsync();
            
            _logger.LogInformation($"Querying database for user: '{request.Username}'");
            
            // Debug: Log all users in database
            var allUsers = await context.Users.ToListAsync();
            _logger.LogInformation($"Total users in database: {allUsers.Count}");
            foreach (var u in allUsers)
            {
                _logger.LogInformation($"DB User: {u.Username}, Role: {u.RoleType}, Active: {u.IsActive}");
            }

            var user = await context.Users
                .FirstOrDefaultAsync(u => 
                    u.Username == request.Username && 
                    u.Password == request.Password && 
                    u.IsActive);

            if (user == null)
            {
                _logger.LogWarning($"Login failed for username: '{request.Username}' - User not found or invalid password");
                throw new Exception("Invalid username or password");
            }

            _logger.LogInformation($"User '{user.Username}' logged in successfully");

            return new LoginResponseDTO
            {
                Success = true,
                Message = "Login successful",
                User = new UserDTO
                {
                    UserId = user.UserId,
                    Username = user.Username,
                    FullName = user.FullName,
                    RoleType = user.RoleType.ToString(),
                    IsActive = user.IsActive
                },
                Token = "dummy-jwt-token" // Replace with real JWT token generation
            };
        }

        // Add static method to get current user ID
        public static int GetCurrentUserId()
        {
            if (!CurrentUserId.HasValue)
            {
                throw new InvalidOperationException("No user is currently logged in");
            }
            return CurrentUserId.Value;
        }
    }
} 