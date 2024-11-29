class DocumentSync {
    static async initialize() {
        try {
            console.log('🔄 Starting document synchronization...');
            const result = await this.syncDocuments();
            
            if (!result) {
                console.log('⚠️ No sync result received');
                return;
            }

            const hasChanges = (result.downloaded && result.downloaded.length > 0) || 
                             (result.deleted && result.deleted.length > 0);
            
            if (hasChanges) {
                this.showSyncNotification(result);
            }
            
            console.log('✅ Document sync completed:', result);
            return result;
        } catch (error) {
            console.error('❌ Document sync failed:', error);
            showToast('Document sync failed: ' + (error.message || 'Unknown error'), 'error');
            throw error;
        }
    }

    static async syncDocuments() {
        return new Promise((resolve, reject) => {
            try {
                let hasReceivedResponse = false;

                window.electronAPI.send('document-sync', '');
                
                window.electronAPI.receive('document-sync-complete', (result) => {
                    hasReceivedResponse = true;
                    try {
                        const syncResult = JSON.parse(result);
                        resolve({
                            downloaded: syncResult.downloaded || [],
                            deleted: syncResult.deleted || [],
                            failed: syncResult.failed || []
                        });
                    } catch (error) {
                        console.error('Error parsing sync result:', error);
                        resolve({ downloaded: [], deleted: [], failed: [] });
                    }
                });
                
                window.electronAPI.receive('document-error', (error) => {
                    hasReceivedResponse = true;
                    console.error('Sync error received:', error);
                    reject(typeof error === 'string' ? JSON.parse(error) : error);
                });

                // Add timeout
            setTimeout(() => {
                    if (!hasReceivedResponse) {
                        reject(new Error('Document sync timed out'));
                    }
                }, 30000); // 30 second timeout
            } catch (error) {
                reject(error);
            }
        });
    }

    static showSyncNotification(result) {
        if (!result) return;

        const downloadCount = result.downloaded?.length || 0;
        const deleteCount = result.deleted?.length || 0;
        
        let message = '';
        if (downloadCount > 0) {
            message += `📥 Downloaded ${downloadCount} document${downloadCount > 1 ? 's' : ''}\n`;
        }
        if (deleteCount > 0) {
            message += `🗑️ Removed ${deleteCount} outdated document${deleteCount > 1 ? 's' : ''}`;
        }

        if (message) {
            showToast(message.trim(), 'success');
        }
    }
}

// Add event listener for page load
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('🔄 Initializing document sync on page load...');
        await DocumentSync.initialize();
    } catch (error) {
        console.error('Failed to initialize document sync:', error);
    }
});

// Add event listener for window focus
let syncInProgress = false;
window.addEventListener('focus', async () => {
    if (syncInProgress) {
        console.log('🔄 Sync already in progress, skipping...');
        return;
    }

    try {
        syncInProgress = true;
        console.log('🔄 Initializing document sync on window focus...');
        await DocumentSync.initialize();
    } catch (error) {
        console.error('Failed to sync documents on window focus:', error);
    } finally {
        syncInProgress = false;
    }
});

// Export for use in other modules
window.DocumentSync = DocumentSync;
