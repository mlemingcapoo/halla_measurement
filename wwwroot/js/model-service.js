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
                    specifications: []
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
        return new Promise((resolve, reject) => {
            window.electronAPI.send('model-getById', JSON.stringify(id));
            window.electronAPI.receive('model-details', (result) => resolve(JSON.parse(result)));
            window.electronAPI.receive('model-error', (error) => reject(JSON.parse(error)));
        });
    }

    static async updateModel(modelData) {
        return new Promise((resolve, reject) => {
            try {
                console.log('Sending update request with data:', modelData);
                window.electronAPI.send('model-update', JSON.stringify(modelData));
                window.electronAPI.receive('model-updated', (result) => resolve(JSON.parse(result)));
                window.electronAPI.receive('model-error', (error) => {
                    console.error('Received error:', error);
                    reject(JSON.parse(error));
                });
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
}