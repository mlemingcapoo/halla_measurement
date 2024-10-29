class ModelSpecificationService {
    static async createSpecification(specData) {
        return new Promise((resolve, reject) => {
            try {
                const data = {
                    ModelId: parseInt(specData.modelId),
                    SpecName: specData.specName,
                    MinValue: parseFloat(specData.minValue),
                    MaxValue: parseFloat(specData.maxValue),
                    Unit: specData.unit,
                    DisplayOrder: parseInt(specData.displayOrder)
                };

                console.log('Sending specification data:', data);
                window.electronAPI.send('spec-create', JSON.stringify(data));
                window.electronAPI.receive('spec-created', (result) => resolve(JSON.parse(result)));
                window.electronAPI.receive('spec-error', (error) => reject(JSON.parse(error)));
            } catch (error) {
                reject(error);
            }
        });
    }

    static async getSpecifications(modelId) {
        return new Promise((resolve, reject) => {
            const data = { ModelId: parseInt(modelId) };
            window.electronAPI.send('spec-getAll', JSON.stringify(data));
            window.electronAPI.receive('spec-list', (result) => resolve(JSON.parse(result)));
            window.electronAPI.receive('spec-error', (error) => reject(JSON.parse(error)));
        });
    }

    static async updateSpecification(specData) {
        return new Promise((resolve, reject) => {
            try {
                const data = {
                    SpecId: parseInt(specData.specId),
                    ModelId: parseInt(specData.modelId),
                    SpecName: specData.specName,
                    MinValue: parseFloat(specData.minValue),
                    MaxValue: parseFloat(specData.maxValue),
                    Unit: specData.unit,
                    DisplayOrder: parseInt(specData.displayOrder)
                };

                window.electronAPI.send('spec-update', JSON.stringify(data));
                window.electronAPI.receive('spec-updated', (result) => resolve(JSON.parse(result)));
                window.electronAPI.receive('spec-error', (error) => reject(JSON.parse(error)));
            } catch (error) {
                reject(error);
            }
        });
    }

    static async deleteSpecification(specId) {
        return new Promise((resolve, reject) => {
            window.electronAPI.send('spec-delete', JSON.stringify(parseInt(specId)));
            window.electronAPI.receive('spec-deleted', (result) => resolve(JSON.parse(result)));
            window.electronAPI.receive('spec-error', (error) => reject(JSON.parse(error)));
        });
    }
} 