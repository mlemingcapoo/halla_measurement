class ActionHistoryService {
    static async getHistoryByUser(userId) {
        try {
            console.log('🔍 Fetching action history for user ID:', userId);
            
            const response = await new Promise((resolve) => {
                console.log('📡 Setting up IPC listener for action history response');
                
                window.electronAPI.receive('actionHistory:getByUser-response', (result) => {
                    console.log('📥 Received action history response:', result);
                    resolve(JSON.parse(result));
                });

                console.log('📤 Sending request for user history...');
                window.electronAPI.send('actionHistory:getByUser', userId.toString());
            });

            if (!response.success) {
                console.error('❌ Failed to get history:', response.message);
                throw new Error(response.message);
            }

            console.log('✅ Successfully retrieved history:', response.history.length, 'items');
            return response.history;
        } catch (error) {
            console.error('❌ Error in getHistoryByUser:', error);
            throw error;
        }
    }

    static formatActionType(actionType) {
        console.log('🏷️ Formatting action type:', actionType);
        const formatted = (() => {
            switch (actionType.toUpperCase()) {
                case 'CREATE': return 'Created';
                case 'UPDATE': return 'Updated';
                case 'DELETE': return 'Deleted';
                default: 
                    console.warn('⚠️ Unknown action type:', actionType);
                    return actionType;
            }
        })();
        console.log('✨ Formatted action type:', formatted);
        return formatted;
    }

    static formatDateTime(dateTime) {
        console.log('📅 Formatting datetime:', dateTime);
        const formatted = new Date(dateTime).toLocaleString();
        console.log('✨ Formatted datetime:', formatted);
        return formatted;
    }

    static createHistoryListItem(action) {
        console.log('🔨 Creating history list item for action:', action);
        
        const div = document.createElement('div');
        div.className = 'border-b border-gray-200 p-4 hover:bg-gray-50';
        
        let actionDescription = '';
        switch (action.ActionType.toUpperCase()) {
            case 'CREATE':
                actionDescription = `Created new ${action.TableName.toLowerCase()} record`;
                break;
            case 'UPDATE':
                actionDescription = `Changed ${action.ColumnName} from "${action.OldValue}" to "${action.NewValue}"`;
                break;
            case 'DELETE':
                actionDescription = `Deleted ${action.TableName.toLowerCase()} record`;
                break;
        }
        console.log('📝 Generated action description:', actionDescription);

        const actionTypeClass = (() => {
            switch (action.ActionType) {
                case 'CREATE': return 'bg-green-100 text-green-800';
                case 'UPDATE': return 'bg-blue-100 text-blue-800';
                case 'DELETE': return 'bg-red-100 text-red-800';
                default: 
                    console.warn('⚠️ Unknown action type for styling:', action.ActionType);
                    return 'bg-gray-100 text-gray-800';
            }
        })();
        console.log('🎨 Selected action type class:', actionTypeClass);

        div.innerHTML = `
            <div class="flex justify-between items-start">
                <div>
                    <p class="text-sm font-medium text-gray-900">${actionDescription}</p>
                    <p class="text-xs text-gray-500">${this.formatDateTime(action.ModifiedAt)}</p>
                </div>
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${actionTypeClass}">
                    ${this.formatActionType(action.ActionType)}
                </span>
            </div>
        `;

        console.log('✅ History list item created');
        return div;
    }
}
