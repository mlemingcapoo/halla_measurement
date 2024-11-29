using ElectronNET.API;
using ElectronNET.API.Entities;
using Microsoft.Extensions.Logging;
using Microsoft.EntityFrameworkCore;
using Models;
using Models.DTO;
using System.Text.Json;

namespace Services
{
    public class UserIPCService : IIPCService
    {
        private readonly ILogger<UserIPCService> _logger;
        private readonly IDbContextFactory<ApplicationDbContext> _contextFactory;
        private readonly ActionHistoryService _historyService;

        public UserIPCService(
            ILogger<UserIPCService> logger,
            IDbContextFactory<ApplicationDbContext> contextFactory,
            ActionHistoryService historyService)
        {
            _logger = logger;
            _contextFactory = contextFactory;
            _historyService = historyService;
        }

        public void RegisterEvents(BrowserWindow window)
        {
            // Get all users
            Electron.IpcMain.On("users:getAll", async (args) =>
            {
                try
                {
                    using var context = await _contextFactory.CreateDbContextAsync();
                    var users = await context.Users.ToListAsync();
                    var userDtos = users.Select(u => new UserDTO
                    {
                        UserId = u.UserId,
                        Username = u.Username,
                        FullName = u.FullName,
                        RoleType = u.RoleType.ToString(),
                        IsActive = u.IsActive
                    }).ToList();

                    Electron.IpcMain.Send(window, "users:getAll-response", 
                        JsonSerializer.Serialize(new { success = true, users = userDtos }));
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to get users");
                    Electron.IpcMain.Send(window, "users:getAll-response", 
                        JsonSerializer.Serialize(new { success = false, message = ex.Message }));
                }
            });

            // Create user
            Electron.IpcMain.On("users:create", async (args) =>
            {
                try
                {
                    var userDto = JsonSerializer.Deserialize<UserDTO>(args.ToString());
                    using var context = await _contextFactory.CreateDbContextAsync();

                    var user = new User
                    {
                        Username = userDto.Username,
                        FullName = userDto.FullName,
                        Password = userDto.Password,
                        RoleType = Enum.Parse<UserRole>(userDto.RoleType),
                        IsActive = true,
                        CreatedAt = DateTime.UtcNow
                    };

                    context.Users.Add(user);
                    await context.SaveChangesAsync();

                    await _historyService.TrackCreate("Users", user.UserId, 
                        $"New user created: {user.Username}");

                    Electron.IpcMain.Send(window, "users:create-response", 
                        JsonSerializer.Serialize(new { success = true, user = userDto }));
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to create user");
                    Electron.IpcMain.Send(window, "users:create-response", 
                        JsonSerializer.Serialize(new { success = false, message = ex.Message }));
                }
            });

            // Update user
            Electron.IpcMain.On("users:update", async (args) =>
            {
                try
                {
                    var userDto = JsonSerializer.Deserialize<UserDTO>(args.ToString());
                    using var context = await _contextFactory.CreateDbContextAsync();

                    var user = await context.Users.FindAsync(userDto.UserId);
                    if (user == null)
                        throw new Exception("User not found");

                    // Store old values for history tracking
                    var oldUsername = user.Username;
                    var oldFullName = user.FullName;
                    var oldRoleType = user.RoleType;
                    var oldIsActive = user.IsActive;
                    var oldPassword = user.Password;

                    // Update basic info
                    user.Username = userDto.Username;
                    user.FullName = userDto.FullName;
                    user.RoleType = Enum.Parse<UserRole>(userDto.RoleType);
                    user.IsActive = userDto.IsActive;

                    // Update password only if provided
                    if (!string.IsNullOrEmpty(userDto.Password))
                    {
                        _logger.LogInformation("Updating password for user: {UserId}", user.UserId);
                        user.Password = userDto.Password;
                        await _historyService.TrackUpdate(
                            "Users",
                            "Password",
                            user.UserId,
                            oldPassword,
                            user.Password,
                            "Password changed"
                        );
                    }

                    await context.SaveChangesAsync();

                    // Track changes for each field
                    if (oldUsername != user.Username)
                    {
                        await _historyService.TrackUpdate(
                            "Users",
                            "Username",
                            user.UserId,
                            oldUsername,
                            user.Username,
                            "Username changed"
                        );
                    }

                    if (oldFullName != user.FullName)
                    {
                        await _historyService.TrackUpdate(
                            "Users",
                            "FullName",
                            user.UserId,
                            oldFullName,
                            user.FullName,
                            "Full name changed"
                        );
                    }

                    if (oldRoleType != user.RoleType)
                    {
                        await _historyService.TrackUpdate(
                            "Users",
                            "RoleType",
                            user.UserId,
                            oldRoleType.ToString(),
                            user.RoleType.ToString(),
                            "Role changed"
                        );
                    }

                    if (oldIsActive != user.IsActive)
                    {
                        await _historyService.TrackUpdate(
                            "Users",
                            "IsActive",
                            user.UserId,
                            oldIsActive.ToString(),
                            user.IsActive.ToString(),
                            "Status changed"
                        );
                    }

                    // Convert updated user to DTO for response
                    var updatedUserDto = new UserDTO
                    {
                        UserId = user.UserId,
                        Username = user.Username,
                        FullName = user.FullName,
                        RoleType = user.RoleType.ToString(),
                        IsActive = user.IsActive
                    };

                    _logger.LogInformation("User updated successfully: {UserId}", user.UserId);
                    Electron.IpcMain.Send(window, "users:update-response", 
                        JsonSerializer.Serialize(new { success = true, user = updatedUserDto }));
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to update user");
                    Electron.IpcMain.Send(window, "users:update-response", 
                        JsonSerializer.Serialize(new { success = false, message = ex.Message }));
                }
            });

            // Delete user
            Electron.IpcMain.On("users:delete", async (args) =>
            {
                try
                {
                    var userId = int.Parse(args.ToString());
                    using var context = await _contextFactory.CreateDbContextAsync();

                    var user = await context.Users.FindAsync(userId);
                    if (user == null)
                        throw new Exception("User not found");

                    context.Users.Remove(user);
                    await context.SaveChangesAsync();

                    await _historyService.TrackDelete("Users", userId, null);

                    Electron.IpcMain.Send(window, "users:delete-response", 
                        JsonSerializer.Serialize(new { success = true, userId = userId }));
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to delete user");
                    Electron.IpcMain.Send(window, "users:delete-response", 
                        JsonSerializer.Serialize(new { success = false, message = ex.Message }));
                }
            });
        }
    }
} 