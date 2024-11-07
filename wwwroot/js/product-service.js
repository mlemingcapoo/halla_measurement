class ProductService {
    static async createProduct(productData) {
        return new Promise((resolve, reject) => {
            try {
                const data = {
                    modelId: parseInt(productData.modelId),
                    measurementDate: productData.measurementDate || new Date().toISOString(),
                    status: productData.status || 'Pending'
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
        //console.log('ProductService: getProductsByModelId called with modelId:', modelId);
        return new Promise((resolve, reject) => {
            try {
                //console.log('ProductService: Starting getProductsByModelId');
                //console.log('ProductService: Sending request for modelId:', modelId);

                window.electronAPI.send('product-getByModelId', modelId);

                window.electronAPI.receive('product-list', (result) => {
                    //console.log('ProductService: Received product-list response:', result);
                    try {
                        let products = [];
                        if (result && result[0]) {
                            //console.log('ProductService: Parsing result[0]:', result[0]);
                            products = JSON.parse(result[0]);
                            //console.log('ProductService: Successfully parsed products:', products);
                        }
                        //console.log('ProductService: Resolving with products:', products);
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

    static async updateProductStatus(productId, status, measurementDate = null) {
        return new Promise((resolve, reject) => {
            try {
                const data = {
                    productId: parseInt(productId),
                    status: status,
                    measurementDate: measurementDate
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

} 