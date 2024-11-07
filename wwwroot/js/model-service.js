class ModelService {
    static async createModel(modelData) {
        return new Promise((resolve, reject) => {
            try {
                const data = {
                    modelCode: modelData.modelCode,
                    modelName: modelData.modelName,
                    description: modelData.description,
                    createdAt: modelData.createdAt,
                    totalProducts: modelData.totalProducts,
                    specifications: [],
                    images: modelData.images || []
                };

                window.electronAPI.send('model-create', JSON.stringify(data));
                window.electronAPI.receive('model-created', (result) => resolve(JSON.parse(result)));
                window.electronAPI.receive('model-error', (error) => reject(JSON.parse(error)));
            } catch (error) {
                reject(error);
            }
        });
    }

    static async getAllModels() {
        return new Promise((resolve, reject) => {
            window.electronAPI.send('model-getAll', '');
            window.electronAPI.receive('model-list', (result) => resolve(JSON.parse(result)));
            window.electronAPI.receive('model-error', (error) => reject(JSON.parse(error)));
        });
    }

    static async getModelById(id) {
        console.log('🔵 [Client] Starting getModelById with id:', id);
        return new Promise((resolve, reject) => {
            try {
                console.log('🔵 [Client] Setting up IPC listeners');
                
                // Add error handler first
                window.electronAPI.receive('model-error', (error) => {
                    console.error('🔵 [Client] Received error from IPC:', error);
                    try {
                        // Handle array of errors
                        if (Array.isArray(error)) {
                            error = error[0];
                        }
                        // Try to parse the error if it's a string
                        const parsedError = typeof error === 'string' ? JSON.parse(error) : error;
                        reject(parsedError);
                    } catch (e) {
                        reject({ error: 'Failed to parse error message' });
                    }
                });

                // Add success handler
                window.electronAPI.receive('model-details', (result) => {
                    try {
                        console.log('🔵 [Client] Received raw result:', result);
                        // Handle array of results
                        if (Array.isArray(result)) {
                            result = result[0];
                        }
                        const model = typeof result === 'string' ? JSON.parse(result) : result;
                        console.log('🔵 [Client] Parsed model:', model);
                        
                        if (!model) {
                            throw new Error('Model data is null or undefined');
                        }
                        
                        resolve(model);
                    } catch (error) {
                        console.error('🔵 [Client] Error parsing model data:', error);
                        reject(error);
                    }
                });

                // Send the request with proper ID formatting
                const modelId = typeof id === 'string' ? parseInt(id) : id;
                console.log('🔵 [Client] Sending IPC request with ID:', modelId);
                window.electronAPI.send('model-getById', JSON.stringify(modelId));

            } catch (error) {
                console.error('🔵 [Client] Critical error in getModelById:', error);
                reject(error);
            }
        });
    }

    static async updateModel(modelData) {
        return new Promise((resolve, reject) => {
            try {
                const simplifiedData = {
                    ModelId: modelData.ModelId,
                    ModelCode: modelData.modelCode,
                    ModelName: modelData.modelName,
                    Description: modelData.description,
                    CreatedAt: modelData.createdAt || new Date().toISOString(),
                    TotalProducts: modelData.totalProducts || 0,
                    Images: modelData.images || []
                };

                window.electronAPI.send('model-update', JSON.stringify(simplifiedData));
                window.electronAPI.receive('model-updated', (result) => resolve(JSON.parse(result)));
                window.electronAPI.receive('model-error', (error) => reject(JSON.parse(error)));
            } catch (error) {
                reject(error);
            }
        });
    }

    static async deleteModel(id) {
        return new Promise((resolve, reject) => {
            window.electronAPI.send('model-delete', JSON.stringify(id));
            window.electronAPI.receive('model-deleted', (result) => resolve(JSON.parse(result)));
            window.electronAPI.receive('model-error', (error) => reject(JSON.parse(error)));
        });
    }

    static async deleteModelImage(imageId) {
        return new Promise((resolve, reject) => {
            window.electronAPI.send('image-delete', JSON.stringify(imageId));
            window.electronAPI.receive('image-deleted', (result) => resolve(JSON.parse(result)));
            window.electronAPI.receive('image-error', (error) => reject(JSON.parse(error)));
        });
    }

    static async debugCheckImages() {
        console.log('🔍 [Debug] Checking database images');
        return new Promise((resolve, reject) => {
            try {
                window.electronAPI.send('debug-check-images', '');
                window.electronAPI.receive('debug-images-result', (result) => {
                    console.log('🔍 [Debug] Database state:', JSON.parse(result));
                    resolve(JSON.parse(result));
                });
            } catch (error) {
                console.error('🔍 [Debug] Error:', error);
                reject(error);
            }
        });
    }
}