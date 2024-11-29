class ModelSpecificationService {
    static async createSpecification(specData) {
        return new Promise((resolve, reject) => {
            try {
                const data = {
                    modelId: parseInt(specData.modelId),
                    specName: specData.specName,
                    equipName: specData.equipName,
                    minValue: parseFloat(specData.minValue),
                    maxValue: parseFloat(specData.maxValue),
                    unit: specData.unit,
                    processName: specData.processName
                };

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
            const data = { modelId: parseInt(modelId) };
            window.electronAPI.send('spec-getAll', JSON.stringify(data));
            window.electronAPI.receive('spec-list', (result) => resolve(JSON.parse(result)));
            window.electronAPI.receive('spec-error', (error) => reject(JSON.parse(error)));
        });
    }

    static async updateSpecification(specData) {
        return new Promise((resolve, reject) => {
            try {
                const data = {
                    specId: parseInt(specData.specId),
                    modelId: parseInt(specData.modelId),
                    specName: specData.specName,
                    equipName: specData.equipName,
                    minValue: parseFloat(specData.minValue),
                    maxValue: parseFloat(specData.maxValue),
                    unit: specData.unit,
                    processName: specData.processName
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

    static async getSpecificationById(specId) {
        return new Promise((resolve, reject) => {
            try {
                window.electronAPI.send('spec-getById', JSON.stringify(parseInt(specId)));
                window.electronAPI.receive('spec-detail', (result) => resolve(JSON.parse(result)));
                window.electronAPI.receive('spec-error', (error) => reject(JSON.parse(error)));
            } catch (error) {
                reject(error);
            }
        });
    }

    static async getAllEquipments() {
        return new Promise((resolve, reject) => {
            window.electronAPI.send('equip-getAll', '');
            window.electronAPI.receive('equip-list', (result) => resolve(JSON.parse(result)));
            window.electronAPI.receive('equip-error', (error) => reject(JSON.parse(error)));
        });
    }

    static async createEquipment(equipData) {
        return new Promise((resolve, reject) => {
            try {
                console.log('📤 Creating equipment with data:', equipData);
                window.electronAPI.send('equip-create', JSON.stringify({
                    EquipName: equipData.EquipName
                }));
                
                window.electronAPI.receive('equip-created', (result) => {
                    console.log('✅ Equipment created:', result);
                    resolve(JSON.parse(result));
                });
                
                window.electronAPI.receive('equip-error', (error) => {
                    console.log('🔴 Create Equipment Error:', error);
                    try {
                        if (Array.isArray(error)) {
                            error = error[0];
                        }
                        if (typeof error === 'string') {
                            error = JSON.parse(error);
                        }
                        reject(new Error(error.error || 'Unknown error occurred'));
                    } catch (parseError) {
                        console.error('🔴 Error parsing error message:', parseError);
                        reject(new Error('Failed to process error message'));
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    static async updateEquipment(equipData) {
        return new Promise((resolve, reject) => {
            try {
                window.electronAPI.send('equip-update', JSON.stringify(equipData));
                window.electronAPI.receive('equip-updated', (result) => resolve(JSON.parse(result)));
                window.electronAPI.receive('equip-error', (error) => {
                    if (Array.isArray(error)) error = error[0];
                    reject(JSON.parse(error));
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    static async deleteEquipment(equipId) {
        return new Promise((resolve, reject) => {
            try {
                console.log('🗑️ Deleting equipment:', equipId);
                window.electronAPI.send('equip-delete', JSON.stringify(equipId));
                
                window.electronAPI.receive('equip-deleted', (result) => {
                    const response = JSON.parse(result);
                    console.log('✅ Equipment deleted, affected specs:', response.affectedSpecs);
                    resolve(response);
                });
                
                window.electronAPI.receive('equip-error', (error) => {
                    console.error('❌ Error deleting equipment:', error);
                    if (Array.isArray(error)) error = error[0];
                    reject(JSON.parse(error));
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    static async getEquipmentById(equipId) {
        return new Promise((resolve, reject) => {
            try {
                window.electronAPI.send('equip-getById', JSON.stringify(equipId));
                window.electronAPI.receive('equip-details', (result) => resolve(JSON.parse(result)));
                window.electronAPI.receive('equip-error', (error) => {
                    if (Array.isArray(error)) error = error[0];
                    reject(JSON.parse(error));
                });
            } catch (error) {
                reject(error);
            }
        });
    }
} 