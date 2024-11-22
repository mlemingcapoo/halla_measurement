class ProductService {
    static async createProduct(productData) {
        return new Promise((resolve, reject) => {
            try {
                const data = {
                    modelId: parseInt(productData.modelId),
                    measurementDate: productData.measurementDate || new Date().toISOString(),
                    moldNumber: productData.moldNumber || ''
                };

                window.electronAPI.send('product-create', JSON.stringify(data));
                window.electronAPI.receive('product-created', (result) => resolve(JSON.parse(result)));
                window.electronAPI.receive('product-error', (error) => reject(JSON.parse(error)));
            } catch (error) {
                reject(error);
            }
        });
    }

    static async getAllProducts() {
        return new Promise((resolve, reject) => {
            window.electronAPI.send('product-getAll', '');
            window.electronAPI.receive('product-list', (result) => {
                try {
                    if (Array.isArray(result) && result.length > 0) {
                        const jsonStr = result[0];
                        const products = JSON.parse(jsonStr);
                        resolve(products);
                    } else {
                        resolve([]);
                    }
                } catch (error) {
                    reject(error);
                }
            });
            window.electronAPI.receive('product-error', (error) => reject(JSON.parse(error)));
        });
    }

    static async getProductsByModelId(modelId) {
        return new Promise((resolve, reject) => {
            try {
                window.electronAPI.send('product-getByModelId', modelId);

                window.electronAPI.receive('product-list', (result) => {
                    try {
                        let products = [];
                        if (result && result[0]) {
                            products = JSON.parse(result[0]);
                        }
                        resolve(products);
                    } catch (error) {
                        console.error('ProductService: Error parsing products:', error);
                        resolve([]);
                    }
                });

                window.electronAPI.receive('product-error', (error) => {
                    console.error('ProductService: Received error:', error);
                    reject(new Error(error));
                });
            } catch (error) {
                console.error('ProductService: Exception in getProductsByModelId:', error);
                reject(error);
            }
        });
    }

    static async updateProduct(productId, measurementDate = null, moldNumber = '') {
        return new Promise((resolve, reject) => {
            try {
                const data = {
                    productId: parseInt(productId),
                    measurementDate: measurementDate,
                    moldNumber: moldNumber
                };
                window.electronAPI.send('product-updateStatus', JSON.stringify(data));
                window.electronAPI.receive('product-updated', (result) => resolve(JSON.parse(result)));
                window.electronAPI.receive('product-error', (error) => reject(JSON.parse(error)));
            } catch (error) {
                reject(error);
            }
        });
    }

    static async deleteProduct(id) {
        return new Promise((resolve, reject) => {
            window.electronAPI.send('product-delete', JSON.stringify(id));
            window.electronAPI.receive('product-deleted', (result) => resolve(JSON.parse(result)));
            window.electronAPI.receive('product-error', (error) => reject(JSON.parse(error)));
        });
    }

    static async getProductsByModelAndMold(modelId, moldNumber = '') {
        return new Promise((resolve, reject) => {
            try {
                if (!moldNumber) {
                    return this.getProductsByModelId(modelId)
                        .then(resolve)
                        .catch(reject);
                }

                console.log('🔍 Getting products for model:', modelId, 'and mold:', moldNumber);
                
                this.getProductsByModelId(modelId)
                    .then(products => {
                        const filteredProducts = products.filter(p => p.MoldNumber === moldNumber);
                        console.log('📊 Filtered products:', {
                            total: products.length,
                            filtered: filteredProducts.length,
                            moldNumber
                        });
                        resolve(filteredProducts);
                    })
                    .catch(reject);

            } catch (error) {
                console.error('❌ Error in getProductsByModelAndMold:', error);
                reject(error);
            }
        });
    }

    static async getMoldsByModel(modelId) {
        return new Promise((resolve, reject) => {
            try {
                console.log('🚀 getMoldsByModel called with modelId:', modelId);
                
                const data = JSON.stringify({ modelId: modelId });
                console.log('📦 Sending data to IPC:', data);
                
                window.electronAPI.send('molds-getByModel', data);
                
                window.electronAPI.receive('molds-list', (result) => {
                    console.log('✅ Received molds-list result:', result);
                    try {
                        // Check if result is already an object
                        const molds = typeof result === 'string' ? JSON.parse(result) : result;
                        console.log('📊 Parsed molds:', molds);
                        resolve(molds);
                    } catch (error) {
                        console.error('❌ Error parsing molds:', error);
                        console.error('Raw result:', result);
                        resolve([]);
                    }
                });
                
                window.electronAPI.receive('molds-error', (error) => {
                    console.error('❌ Received molds-error:', error);
                    console.error('Error type:', typeof error);
                    console.error('Error stringified:', JSON.stringify(error));
                    reject(new Error(error[0] || error));
                });
            } catch (error) {
                console.error('❌ Exception in getMoldsByModel:', error);
                reject(error);
            }
        });
    }
} 