class ModelService {
    static async createModel(modelData) {
        return new Promise((resolve, reject) => {
            try {
                window.electronAPI.send('model-create', JSON.stringify(modelData));
                window.electronAPI.receive('model-created', (result) => resolve(JSON.parse(result)));
                window.electronAPI.receive('model-error', (error) => {
                    // console.log('🔴 Create Model Error:', error);
                    try {
                        // Handle array response
                        if (Array.isArray(error)) {
                            error = error[0];
                        }
                        
                        // Parse error if it's a string
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

    static async getAllModels() {
        return new Promise((resolve, reject) => {
            window.electronAPI.send('model-getAll', '');
            window.electronAPI.receive('model-list', (result) => resolve(JSON.parse(result)));
            window.electronAPI.receive('model-error', (error) => reject(JSON.parse(error)));
        });
    }

    static async getModelById(id) {
        // console.log('🔵 [Client] Starting getModelById with id:', id);
        return new Promise((resolve, reject) => {
            try {
                // console.log('🔵 [Client] Setting up IPC listeners');
                
                window.electronAPI.receive('model-details', (result) => {
                    try {
                        // console.log('🔵 [Client] Received raw model details:', result);
                        if (Array.isArray(result)) {
                            result = result[0];
                        }
                        const model = typeof result === 'string' ? JSON.parse(result) : result;
                        // console.log('🔵 [Client] Parsed model:', model);
                        // console.log('🖼️ [Client] Images:', model.Images);
                        
                        if (model.Images) {
                            model.Images.forEach((img, index) => {
                                // console.log(`🖼️ [Client] Image ${index + 1}:`, {
                                //     ImageId: img.ImageId,
                                //     FileName: img.FileName,
                                //     HasBase64: !!img.Base64Data,
                                //     ContentType: img.ContentType,
                                //     Base64Length: img.Base64Data?.length || 0
                                // });
                            });
                        }
                        
                        if (!model) {
                            throw new Error('Model data is null or undefined');
                        }
                        
                        resolve(model);
                    } catch (error) {
                        console.error('🔴 [Client] Error parsing model data:', error);
                        reject(error);
                    }
                });
                
                window.electronAPI.receive('model-error', (error) => {
                    console.error('🔴 [Client] Received error from IPC:', error);
                    try {
                        if (Array.isArray(error)) {
                            error = error[0];
                        }
                        const parsedError = typeof error === 'string' ? JSON.parse(error) : error;
                        reject(parsedError);
                    } catch (e) {
                        reject({ error: 'Failed to parse error message' });
                    }
                });

                const modelId = typeof id === 'string' ? parseInt(id) : id;
                // console.log('🔵 [Client] Sending IPC request with ID:', modelId);
                window.electronAPI.send('model-getById', JSON.stringify(modelId));

            } catch (error) {
                console.error('🔴 [Client] Critical error in getModelById:', error);
                reject(error);
            }
        });
    }

    static async updateModel(modelData) {
        return new Promise((resolve, reject) => {
            try {
                const data = {
                    modelId: modelData.modelId,
                    partNo: modelData.partNo,
                    partName: modelData.partName,
                    material: modelData.material,
                    productDate: modelData.productDate,
                    wo: modelData.wo,
                    machine: modelData.machine
                };

                window.electronAPI.send('model-update', JSON.stringify(data));
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
        // console.log('🔍 [Debug] Checking database images');
        return new Promise((resolve, reject) => {
            try {
                window.electronAPI.send('debug-check-images', '');
                window.electronAPI.receive('debug-images-result', (result) => {
                    // console.log('🔍 [Debug] Database state:', JSON.parse(result));
                    resolve(JSON.parse(result));
                });
            } catch (error) {
                console.error('🔍 [Debug] Error:', error);
                reject(error);
            }
        });
    }

    static async cloneModel(modelId) {
        return new Promise((resolve, reject) => {
            try {
                window.electronAPI.send('model-clone', JSON.stringify(modelId));
                window.electronAPI.receive('model-cloned', (result) => resolve(JSON.parse(result)));
                window.electronAPI.receive('model-error', (error) => {
                    // console.log('🔴 Received error:', error);
                    try {
                        // Handle array response
                        if (Array.isArray(error)) {
                            error = error[0];
                        }
                        
                        // Handle string JSON
                        if (typeof error === 'string') {
                            error = JSON.parse(error);
                        }
                        
                        // Extract error message
                        const errorMessage = error.error || 'Unknown error occurred';
                        reject(new Error(errorMessage));
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

    static async uploadModelImage(modelId, imageData) {
        return new Promise((resolve, reject) => {
            try {
                // If imageData is already processed (has Base64Data)
                if (imageData.Base64Data) {
                    // console.log('📸 [Client] Uploading pre-processed image data');
                    const data = {
                        ModelId: modelId,
                        Base64Image: imageData.Base64Data,
                        FileName: imageData.FileName,
                        ContentType: imageData.ContentType
                    };
                    
                    window.electronAPI.send('image-create', JSON.stringify(data));
                    window.electronAPI.receive('image-created', (result) => resolve(JSON.parse(result)));
                    window.electronAPI.receive('image-error', (error) => {
                        console.error('❌ [Client] Image upload error:', error);
                        if (Array.isArray(error)) error = error[0];
                        reject(JSON.parse(error));
                    });
                    return;
                }

                // If imageData is a File object
                if (imageData instanceof File) {
                    // console.log('📸 [Client] Processing File object:', {
                    //     name: imageData.name,
                    //     type: imageData.type,
                    //     size: imageData.size
                    // });

                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const data = {
                            ModelId: modelId,
                            Base64Image: e.target.result,
                            FileName: imageData.name,
                            ContentType: imageData.type
                        };
                        
                        window.electronAPI.send('image-create', JSON.stringify(data));
                        window.electronAPI.receive('image-created', (result) => resolve(JSON.parse(result)));
                        window.electronAPI.receive('image-error', (error) => {
                            if (Array.isArray(error)) error = error[0];
                            reject(JSON.parse(error));
                        });
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(imageData);
                    return;
                }

                throw new Error('Invalid image data provided');
            } catch (error) {
                console.error('❌ [Client] Critical error in uploadModelImage:', error);
                reject(error);
            }
        });
    }

    static async getModelImages(modelId) {
        return new Promise((resolve, reject) => {
            try {
                // console.log('🔍 Getting images for model:', modelId);
                window.electronAPI.send('image-getByModel', JSON.stringify(modelId));
                
                window.electronAPI.receive('image-list', (result) => {
                    // console.log('✅ Retrieved images:', result);
                    resolve(JSON.parse(result));
                });
                
                window.electronAPI.receive('image-error', (error) => {
                    console.error('❌ Error getting images:', error);
                    if (Array.isArray(error)) error = error[0];
                    reject(JSON.parse(error));
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    static async updateModelImage(imageData) {
        return new Promise((resolve, reject) => {
            try {
                // console.log('📝 Updating image:', imageData);
                window.electronAPI.send('image-update', JSON.stringify(imageData));
                
                window.electronAPI.receive('image-updated', (result) => {
                    // console.log('✅ Image updated successfully');
                    resolve(JSON.parse(result));
                });
                
                window.electronAPI.receive('image-error', (error) => {
                    console.error('❌ Error updating image:', error);
                    if (Array.isArray(error)) error = error[0];
                    reject(JSON.parse(error));
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    static async deleteModelImage(imageId) {
        return new Promise((resolve, reject) => {
            try {
                // console.log('🗑️ Deleting image:', imageId);
                window.electronAPI.send('image-delete', JSON.stringify(imageId));
                
                window.electronAPI.receive('image-deleted', (result) => {
                    // console.log('✅ Image deleted successfully');
                    resolve(JSON.parse(result));
                });
                
                window.electronAPI.receive('image-error', (error) => {
                    console.error('❌ Error deleting image:', error);
                    if (Array.isArray(error)) error = error[0];
                    reject(JSON.parse(error));
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    static async uploadMultipleImages(modelId, files) {
        // console.log('📸 Starting multiple image upload for model:', modelId);
        const uploadPromises = Array.from(files).map(file => 
            this.uploadModelImage(modelId, file)
        );

        try {
            const results = await Promise.all(uploadPromises);
            // console.log('✅ All images uploaded successfully');
            return results;
        } catch (error) {
            console.error('❌ Error in batch upload:', error);
            throw error;
        }
    }

    static async debugCheckImages() {
        return new Promise((resolve, reject) => {
            try {
                // console.log('🔍 Checking database images');
                window.electronAPI.send('debug-check-images', '');
                
                window.electronAPI.receive('debug-images-result', (result) => {
                    // console.log('🔍 Database state:', JSON.parse(result));
                    resolve(JSON.parse(result));
                });
            } catch (error) {
                console.error('🔍 Debug error:', error);
                reject(error);
            }
        });
    }
}