using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Models;

namespace Services
{
    public class ActionHistoryBuilder
    {
        private ActionHistory _history = new();

        public ActionHistoryBuilder WithTable(string tableName)
        {
            _history.TableName = tableName;
            return this;
        }

        public ActionHistoryBuilder WithColumn(string columnName)
        {
            _history.ColumnName = columnName;
            return this;
        }

        public ActionHistoryBuilder WithRecordId(int recordId)
        {
            _history.RecordId = recordId;
            return this;
        }

        public ActionHistoryBuilder WithAction(string actionType)
        {
            _history.ActionType = actionType;
            return this;
        }

        public ActionHistoryBuilder WithOldValue(string? oldValue)
        {
            _history.OldValue = oldValue;
            return this;
        }

        public ActionHistoryBuilder WithNewValue(string? newValue)
        {
            _history.NewValue = newValue;
            return this;
        }

        public ActionHistoryBuilder WithUser(int? userId = null)
        {
            _history.UserId = userId ?? AuthIPCService.CurrentUserId;
            return this;
        }

        public ActionHistory Build()
        {
            if (!_history.UserId.HasValue)
            {
                _history.UserId = AuthIPCService.CurrentUserId;
            }
            _history.ModifiedAt = DateTime.UtcNow;
            return _history;
        }
    }

    public class ActionHistoryService
    {
        private readonly IDbContextFactory<ApplicationDbContext> _contextFactory;
        private readonly ILogger<ActionHistoryService> _logger;

        public ActionHistoryService(
            IDbContextFactory<ApplicationDbContext> contextFactory,
            ILogger<ActionHistoryService> logger)
        {
            _contextFactory = contextFactory;
            _logger = logger;
        }

        public ActionHistoryBuilder CreateHistory()
        {
            return new ActionHistoryBuilder();
        }

        public async Task TrackAction(ActionHistory history)
        {
            try
            {
                if (!history.UserId.HasValue)
                {
                    history.UserId = AuthIPCService.CurrentUserId;
                }

                _logger.LogInformation(
                    "Tracking action: Table={Table}, Column={Column}, Record={Record}, Action={Action}, User={User}",
                    history.TableName, history.ColumnName, history.RecordId, history.ActionType, history.UserId);

                using var context = await _contextFactory.CreateDbContextAsync();
                context.ActionHistories.Add(history);
                await context.SaveChangesAsync();

                _logger.LogInformation(
                    "Action tracked successfully: {HistoryId}", 
                    history.ActionHistoryId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, 
                    "Failed to track action: Table={Table}, Column={Column}, Record={Record}", 
                    history.TableName, history.ColumnName, history.RecordId);
                throw;
            }
        }

        // Helper methods for common operations
        public async Task TrackCreate(string tableName, int recordId, string? details = null)
        {
            var history = CreateHistory()
                .WithTable(tableName)
                .WithColumn("Record")
                .WithRecordId(recordId)
                .WithAction("CREATE")
                .WithNewValue(details ?? recordId.ToString())
                .Build();

            await TrackAction(history);
        }

        public async Task TrackUpdate(
            string tableName, 
            string columnName, 
            int recordId, 
            string? oldValue, 
            string? newValue, 
            string? details = null)
        {
            var history = CreateHistory()
                .WithTable(tableName)
                .WithColumn(columnName)
                .WithRecordId(recordId)
                .WithAction("UPDATE")
                .WithOldValue(oldValue)
                .WithNewValue(newValue)
                .Build();

            await TrackAction(history);
        }

        public async Task TrackDelete(string tableName, int recordId, string? details = null)
        {
            var history = CreateHistory()
                .WithTable(tableName)
                .WithColumn("Record")
                .WithRecordId(recordId)
                .WithAction("DELETE")
                .WithOldValue(details ?? recordId.ToString())
                .Build();

            await TrackAction(history);
        }
    }
} 