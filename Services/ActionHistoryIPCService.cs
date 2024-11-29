using ElectronNET.API;
using ElectronNET.API.Entities;
using Microsoft.Extensions.Logging;
using Microsoft.EntityFrameworkCore;
using Models;
using Models.DTO;
using System.Text.Json;

namespace Services
{
    public class ActionHistoryIPCService : IIPCService
    {
        private readonly ILogger<ActionHistoryIPCService> _logger;
        private readonly IDbContextFactory<ApplicationDbContext> _contextFactory;

        public ActionHistoryIPCService(
            ILogger<ActionHistoryIPCService> logger,
            IDbContextFactory<ApplicationDbContext> contextFactory)
        {
            _logger = logger;
            _contextFactory = contextFactory;
        }

        public void RegisterEvents(BrowserWindow window)
        {
            // Get action history by user ID
            Electron.IpcMain.On("actionHistory:getByUser", async (args) =>
            {
                try
                {
                    _logger.LogInformation("Received action history request");

                    // Get the userId from args
                    string userIdStr = args.ToString();
                    _logger.LogInformation("Raw userId string: {UserIdStr}", userIdStr);

                    // Try to parse the userId
                    if (!int.TryParse(userIdStr, out int userId))
                    {
                        _logger.LogError("Failed to parse userId: {UserIdStr}", userIdStr);
                        throw new Exception($"Invalid user ID format: {userIdStr}");
                    }

                    _logger.LogInformation("Getting action history for user ID: {UserId}", userId);

                    using var context = await _contextFactory.CreateDbContextAsync();

                    // Check if user exists
                    var user = await context.Users.FindAsync(userId);
                    if (user == null)
                    {
                        _logger.LogWarning("User not found: {UserId}", userId);
                        throw new Exception($"User not found with ID: {userId}");
                    }

                    var history = await context.ActionHistories
                        .Include(h => h.User)
                        .Where(h => h.UserId == userId)
                        .OrderByDescending(h => h.ModifiedAt)
                        .Take(100)
                        .Select(h => new ActionHistoryDTO
                        {
                            ActionHistoryId = h.ActionHistoryId,
                            TableName = h.TableName,
                            ColumnName = h.ColumnName,
                            RecordId = h.RecordId,
                            ModifiedAt = h.ModifiedAt,
                            OldValue = h.OldValue,
                            NewValue = h.NewValue,
                            ActionType = h.ActionType,
                            UserId = h.UserId,
                            UserName = h.User.Username
                        })
                        .ToListAsync();

                    _logger.LogInformation("Found {Count} history records for user {UserId}", history.Count, userId);

                    var response = new { success = true, history };
                    var jsonResponse = JsonSerializer.Serialize(response);
                    _logger.LogInformation("Sending response with {Count} records", history.Count);

                    Electron.IpcMain.Send(window, "actionHistory:getByUser-response", jsonResponse);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to get action history");
                    var errorResponse = new { success = false, message = ex.Message };
                    Electron.IpcMain.Send(window, "actionHistory:getByUser-response", 
                        JsonSerializer.Serialize(errorResponse));
                }
            });
        }
    }
}
