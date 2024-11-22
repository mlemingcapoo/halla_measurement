class ProductSpecificationService {

    static async addMeasurement(measurementData) {
        return new Promise((resolve, reject) => {
            try {
                const data = {
                    productId: parseInt(measurementData.productId),
                    specId: parseInt(measurementData.specId),
                    value: parseFloat(measurementData.value),
                    measurementDate: measurementData.measurementDate || new Date().toISOString()
                };

                window.electronAPI.send('measurement-create', JSON.stringify(data));

                window.electronAPI.receive('measurement-created', (result) => {
                    const measurement = JSON.parse(result);
                    resolve(measurement);
                });

                window.electronAPI.receive('measurement-error', (error) => {
                    console.error('Received measurement-error:', error);
                    reject(JSON.parse(error));
                });
            } catch (error) {
                console.error('Error in addMeasurement:', error);
                reject(error);
            }
        });
    }

    static async getMeasurements(productId) {
        return new Promise((resolve, reject) => {
            window.electronAPI.send('measurement-getByProduct', JSON.stringify(productId));
            window.electronAPI.receive('measurement-list', (result) => {
                try {
                    const measurements = JSON.parse(result);
                    resolve(measurements);
                } catch (error) {
                    console.error('Error parsing measurements:', error);
                    reject(error);
                }
            });
            window.electronAPI.receive('measurement-error', (error) => {
                console.error('Measurement error:', error);
                reject(JSON.parse(error));
            });
        });
    }

    static async getAllMeasurements() {
        return new Promise((resolve, reject) => {
            window.electronAPI.send('measurement-getAll', '');

            window.electronAPI.receive('measurement-list', (result) => {
                try {
                    let measurements;
                    if (typeof result === 'string') {
                        measurements = JSON.parse(result);
                    } else if (Array.isArray(result) && result.length > 0) {
                        measurements = JSON.parse(result[0]);
                    } else {
                        measurements = result;
                    }
                    resolve(measurements || []);
                } catch (error) {
                    console.error('Parse error:', error);
                    resolve([]);
                }
            });

            window.electronAPI.receive('measurement-error', (error) => {
                console.error('getAllMeasurements error:', error);
                reject(error);
            });
        });
    }

    static async deleteMeasurement(id) {
        return new Promise((resolve, reject) => {
            window.electronAPI.send('measurement-delete', JSON.stringify(id));

            window.electronAPI.receive('measurement-deleted', (result) => {
                resolve(JSON.parse(result));
            });

            window.electronAPI.receive('measurement-error', (error) => {
                console.error('Received measurement-error:', error);
                reject(JSON.parse(error));
            });
        });
    }
} 