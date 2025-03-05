class ExcelService {
    static async exportMeasurementToExcel(productData) {
        return new Promise((resolve, reject) => {
            try {
                window.electronAPI.send('export-measurement-to-excel', JSON.stringify(productData));
                window.electronAPI.receive('excel-export-complete', (result) => resolve(result));
                window.electronAPI.receive('excel-export-error', (error) => reject(error));
            } catch (error) {
                reject(error);
            }
        });
    }

    static async exportMeasurementByModelAndMold(modelId, moldNumber = '', process = 'LQC') {
        return new Promise((resolve, reject) => {
            try {
                if (!modelId) {
                    throw new Error('Model ID is required');
                }

                if (typeof modelId !== 'string' && typeof modelId !== 'number') {
                    throw new Error('Invalid model ID format');
                }

                console.log('📊 Starting export for:', { modelId, moldNumber });
                
                const data = {
                    model: modelId.toString(),
                    mold: moldNumber || '',
                    customer: "",
                    inspectorA: "",
                    inspectorB: "",
                    checkedBy: "",
                    approvedBy: "",
                    process: process
                };

                console.log('📤 Sending export request:', data);
                window.electronAPI.send('export-measurement-by-model-and-mold', JSON.stringify(data));
                
                window.electronAPI.receive('excel-export-complete', (result) => {
                    try {
                        const response = Array.isArray(result) ? JSON.parse(result[0]) : result;
                        console.log('✅ Export complete:', response);
                        resolve(response);
                    } catch (error) {
                        console.error('❌ Parse error:', error);
                        reject(error);
                    }
                });
                
                window.electronAPI.receive('excel-export-error', (error) => {
                    try {
                        const errorData = Array.isArray(error) ? JSON.parse(error[0]) : error;
                        console.error('❌ Export error:', errorData);
                        reject(new Error(errorData.error || 'Unknown error'));
                    } catch (parseError) {
                        console.error('❌ Error parse error:', parseError);
                        reject(new Error('Failed to process error message'));
                    }
                });
            } catch (error) {
                console.error('❌ Export error:', error);
                reject(error);
            }
        });
    }

    static async saveExcelFile(fileName, defaultFileName) {
        return new Promise((resolve, reject) => {
            try {
                console.log('💾 Starting save file process:', { fileName, defaultFileName });
                
                if (!fileName) {
                    console.error('❌ No filename provided');
                    throw new Error('Filename is required');
                }

                const data = {
                    fileName: fileName,
                    defaultFileName: defaultFileName || fileName
                };

                console.log('📤 Preparing save request:', data);
                const jsonData = JSON.stringify(data);
                console.log('📤 Serialized request:', jsonData);

                window.electronAPI.send('save-excel-file', jsonData);

                window.electronAPI.receive('file-saved', (result) => {
                    try {
                        console.log('✅ Raw save result:', result);
                        const response = Array.isArray(result) ? JSON.parse(result[0]) : result;
                        console.log('✅ Parsed save result:', response);
                        resolve(response);
                    } catch (error) {
                        console.error('❌ Parse error:', error);
                        reject(error);
                    }
                });

                window.electronAPI.receive('save-cancelled', () => {
                    console.log('ℹ️ Save cancelled by user');
                    resolve(null);
                });

                window.electronAPI.receive('save-error', (error) => {
                    try {
                        console.error('❌ Raw error data:', error);
                        const errorData = Array.isArray(error) ? JSON.parse(error[0]) : error;
                        console.error('❌ Parsed error:', errorData);
                        reject(new Error(errorData.error || 'Unknown error'));
                    } catch (parseError) {
                        console.error('❌ Error parse error:', parseError);
                        reject(new Error('Failed to process error message'));
                    }
                });
            } catch (error) {
                console.error('❌ Save error:', error);
                reject(error);
            }
        });
    }
} 

// just for testing
// async function handleExportToExcel(productId) {
//     try {
//         const product = await ProductService.getProductDetails(productId);
//         await ExcelService.exportMeasurementToExcel(product);
//     } catch (error) {
//         console.error('Error exporting to Excel:', error);
//         // Show error to user
//     }
// }