// Add this utility function at the top of the file
function safeEncode(obj) {
    try {
        // Convert the object to a JSON string and encode all characters
        return btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
    } catch (error) {
        console.error('Encoding error:', error);
        return '';
    }
}

function safeDecode(str) {
    try {
        // Decode the base64 string and convert back to original characters
        return JSON.parse(decodeURIComponent(escape(atob(str))));
    } catch (error) {
        console.error('Decoding error:', error);
        return null;
    }
}

async function initializeModelSelect() {
    try {
        const models = await ModelService.getAllModels();
        models.sort((a, b) => a.PartNo.localeCompare(b.PartNo));
        
        const select = document.getElementById('modelSelect');
        select.innerHTML = '<option value="">Select Model</option>';
        
        // Initial population with PartNo - PartName format
        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.ModelId;
            option.textContent = `${model.PartNo} - ${model.PartName}`;
            select.appendChild(option);
        });

        $(select).select2({
            placeholder: 'Select Model',
            allowClear: false,
            width: '100%',
            dropdownParent: select.parentElement,
            minimumResultsForSearch: 1,
            searchPlaceholder: 'Search...',
            templateResult: function(data) {
                if (!data.id) return data.text;
                return $('<span class="font-semibold">' + data.text + '</span>');
            }
        });

        $(select).on('change', function() {
            const modelId = $(this).val();
            if (modelId) {
                loadProductMeasurements(modelId);
            }
        });
    } catch (error) {
        console.error('Error initializing model select:', error);
    }
}

async function loadProductMeasurements(modelId) {
    console.log('=== START MEASUREMENT LOADING ===');
    console.log('Loading measurements for ModelId:', modelId);
    
    const tableContainer = document.getElementById('measurements-table');
    tableContainer.style.opacity = '0.5';

    try {
        // Get model specifications
        console.log('1. Fetching specifications...');
        const specs = await ModelSpecificationService.getSpecifications(modelId);
        console.log('1.1 Specifications received:', specs);

        // Get products
        console.log('2. Fetching products...');
        const products = await ProductService.getProductsByModelId(modelId);
        console.log('2.1 Products received:', products);

        // Building table HTML
        console.log('3. Building table HTML...');
        let tableHTML = `
            <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="table-header">STT</th>
                        <th class="table-header">Mold Number</th>
                        <th class="table-header">Time</th>`;

        specs.forEach(spec => {
            tableHTML += `
                <th class="table-header">
                    ${spec.SpecName} (${spec.Unit})
                </th>`;
        });

        tableHTML += `</tr></thead><tbody class="bg-white divide-y divide-gray-200">`;

        if (products && products.length > 0) {
            console.log('4. Processing measurements...');
            products.forEach((product, index) => {
                console.log(`4.1 Processing product ${index + 1}:`, product);
                const measurements = product.Measurements || [];
                console.log(`4.2 Measurements for product ${index + 1}:`, measurements);

                tableHTML += `
                    <tr>
                        <td class="table-cell-base text-gray-900">${index + 1}</td>
                        <td class="table-cell-base text-gray-900">${product.MoldNumber || '--'}</td>
                        <td class="table-cell-base text-gray-900">
                            ${new Date(product.MeasurementDate + 'Z').toLocaleString() || '--'}
                        </td>`;

                specs.forEach(spec => {
                    const measurement = measurements.find(m => m.SpecId === spec.SpecId);
                    const value = measurement ? measurement.Value.toFixed(2) : '--';
                    const isWithinRange = measurement ? 
                        (measurement.Value >= spec.MinValue && measurement.Value <= spec.MaxValue) : 
                        true;

                    const rangeClass = isWithinRange ? 'in-range' : 'out-of-range';

                    tableHTML += `
                        <td class="measurement-cell ${rangeClass}">
                            ${value}
                        </td>`;
                });

                tableHTML += `</tr>`;
            });
        } else {
            tableHTML += `
                <tr>
                    <td colspan="${3 + specs.length}" class="table-cell-base text-gray-500 text-center">
                        No measurement data available for this model
                    </td>
                </tr>`;
        }

        tableHTML += `</tbody></table>`;
        tableContainer.innerHTML = tableHTML;
        
        console.log('=== END MEASUREMENT LOADING ===');

    } catch (error) {
        console.error('=== ERROR IN MEASUREMENT LOADING ===');
        console.error('Error details:', error);
        tableContainer.innerHTML = `
            <div class="text-red-600 p-4">Error loading measurements: ${error.message}</div>`;
    }
    tableContainer.style.opacity = '1';
}

// Export to Excel handler
// document.getElementById('export-to-excel').addEventListener('click', () => {
//     const modelId = document.getElementById('modelSelect').value;
//     if (modelId) {
//         handleExportToExcel(modelId);
//     } else {
//         alert('Please select a model first');
//     }
// });

// Add this function at the top level
function createModal() {
    const modal = document.createElement('div');
    modal.id = 'exportModal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    return modal;
}

function removeModal() {
    const existingModal = document.getElementById('exportModal');
    if (existingModal) {
        existingModal.remove();
    }
}

// Add this function to handle modal content updates
function updateModalContent(modal, type, data) {
    const statusDiv = modal.querySelector('#exportStatus');
    
    if (type === 'success') {
        statusDiv.innerHTML = `
            <div class="text-center space-y-4">
                <div class="text-green-500 mb-4">
                    <svg class="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <h3 class="text-xl font-semibold text-gray-900">Export Successful!</h3>
                <p class="text-gray-600">Your report has been generated successfully.</p>
                <div class="flex justify-center space-x-3 mt-4">
                    <button onclick="handleSaveFile('${data.tempFilePath}', '${data.fileName}')" 
                            class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                        Save File
                    </button>
                    <button onclick="removeModal()" 
                            class="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50">
                        Close
                    </button>
                </div>
            </div>
        `;
    } else {
        statusDiv.innerHTML = `
            <div class="text-center space-y-4">
                <div class="text-red-500 mb-4">
                    <svg class="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </div>
                <h3 class="text-xl font-semibold text-gray-900">Export Failed</h3>
                <p class="text-red-600">${data.message || 'Unknown error occurred'}</p>
                <button onclick="removeModal()" 
                        class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 mt-4">
                    Close
                </button>
            </div>
        `;
    }
}

// Add this function to handle file saving
async function handleSaveFile(tempFilePath, defaultFileName) {
    try {
        // Extract just the filename from the path
        const fileName = tempFilePath.split('\\').pop().split('/').pop();
        const saveResult = await ExcelService.saveExcelFile(fileName, defaultFileName);
        if (saveResult) {
            updateModalContent(document.getElementById('exportModal'), 'success-save', saveResult);
        }
    } catch (error) {
        console.error('Save error:', error);
        updateModalContent(document.getElementById('exportModal'), 'error', error);
    }
}

let currentFilters = {
    dateFrom: null,
    dateTo: null,
    modelId: '',
    moldNumber: ''
};

async function initializeFilters() {
    // Set default date range (last 30 days)
    const today = new Date();
    const thirtyDaysAgo = new Date(today + 'Z');
    thirtyDaysAgo.setDate(today.getDate() - 30);

    document.getElementById('dateFrom').value = thirtyDaysAgo.toISOString().split('T')[0];
    document.getElementById('dateTo').value = today.toISOString().split('T')[0];

    // Initialize model filter
    const models = await ModelService.getAllModels();
    const modelFilter = document.getElementById('modelFilter');
    models.sort((a, b) => a.PartNo.localeCompare(b.PartNo));
    models.forEach(model => {
        const option = document.createElement('option');
        option.value = model.ModelId;
        option.textContent = `${model.PartNo} - ${model.PartName}`;
        modelFilter.appendChild(option);
    });

    // Initialize Select2 for filters
    $('#modelFilter, #moldFilter').select2({
        width: '100%',
        placeholder: 'Select...',
        allowClear: true
    });

    // Add reset function
    function resetFilters() {
        // Reset date inputs to default (last 30 days)
        document.getElementById('dateFrom').value = thirtyDaysAgo.toISOString().split('T')[0];
        document.getElementById('dateTo').value = today.toISOString().split('T')[0];
        
        // Reset model and mold selects
        $('#modelFilter').val('').trigger('change');
        $('#moldFilter').val('').trigger('change');
        
        // Apply the reset filters
        applyFilters();
    }

    // Event listeners
    document.getElementById('applyFilters').addEventListener('click', applyFilters);
    document.getElementById('resetFilters').addEventListener('click', resetFilters);
    document.getElementById('backToSummary').addEventListener('click', showSummaryView);
}

async function applyFilters() {
    currentFilters = {
        dateFrom: document.getElementById('dateFrom').value,
        dateTo: document.getElementById('dateTo').value,
        modelId: $('#modelFilter').val(),
        moldNumber: $('#moldFilter').val()
    };

    console.log('🔍 Applying filters:', currentFilters);
    await loadFilteredSummary();
}

async function loadFilteredSummary() {
    const summaryList = document.getElementById('modelSummaryList');
    summaryList.innerHTML = `
        <div class="col-span-full flex items-center justify-center p-8">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            <span class="ml-2">Loading results...</span>
        </div>
    `;

    try {
        // Get all products first
        const allProducts = await ProductService.getAllProducts();
        console.log('📦 All products loaded:', allProducts.length);

        // Apply filters
        const filteredProducts = allProducts.filter(product => {
            const productDate = new Date(product.MeasurementDate + 'Z');
            const fromDate = new Date(currentFilters.dateFrom + 'Z');
            const toDate = new Date(currentFilters.dateTo + 'Z');
            toDate.setHours(23, 59, 59, 999); // Include the entire end day

            // Date filter
            const dateInRange = productDate >= fromDate && productDate <= toDate;

            // Model filter
            const modelMatches = !currentFilters.modelId || product.ModelId.toString() === currentFilters.modelId;

            // Mold filter
            const moldMatches = !currentFilters.moldNumber || product.MoldNumber === currentFilters.moldNumber;

            const matches = dateInRange && modelMatches && moldMatches;
            console.log('🔍 Product filter check:', {
                productId: product.ProductId,
                date: productDate,
                modelMatch: modelMatches,
                moldMatch: moldMatches,
                matches: matches
            });

            return matches;
        });

        console.log('🔍 Filtered products:', filteredProducts.length);

        // Group products by model
        const modelGroups = {};
        for (const product of filteredProducts) {
            if (!modelGroups[product.ModelId]) {
                const model = await ModelService.getModelById(product.ModelId);
                modelGroups[product.ModelId] = {
                    model: model,
                    count: 0,
                    products: []
                };
            }
            modelGroups[product.ModelId].count++;
            modelGroups[product.ModelId].products.push(product);
        }

        console.log('📊 Model groups:', modelGroups);

        // Generate summary cards
        const summaryCards = Object.values(modelGroups).map(group => {
            // Use the new safeEncode function
            const productsData = safeEncode(group.products);
            
            return `
                <div class="bg-gray-50 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                     data-model-id="${group.model.ModelId}"
                     data-products="${productsData}"
                     onclick="handleModelClick(this)">
                    <h3 class="font-semibold">${group.model.PartNo} - ${group.model.PartName}</h3>
                    <p class="text-gray-600">Products measured: ${group.count}</p>
                    <p class="text-sm text-gray-500">Click to view details</p>
                </div>
            `;
        }).join('');

        if (summaryCards) {
            summaryList.innerHTML = summaryCards;
        } else {
            summaryList.innerHTML = `
                <div class="col-span-full text-center p-8 bg-gray-50 rounded-lg">
                    <p class="text-gray-500">No measurements found for the selected filters</p>
                </div>
            `;
        }

        showSummaryView();

    } catch (error) {
        console.error('Error loading summary:', error);
        summaryList.innerHTML = `
            <div class="col-span-full text-center p-8 bg-red-50 rounded-lg">
                <p class="text-red-600">Error loading data: ${error.message}</p>
            </div>
        `;
    }
}

function showSummaryView() {
    document.getElementById('summaryView').classList.remove('hidden');
    document.getElementById('detailView').classList.add('hidden');
}

async function showModelDetails(modelId, filteredProducts) {
    document.getElementById('summaryView').classList.add('hidden');
    document.getElementById('detailView').classList.remove('hidden');
    
    // Use the existing loadProductMeasurements function with filtered products
    await loadProductMeasurements(modelId, filteredProducts);
}

// Add this new function to handle the click event
function handleModelClick(element) {
    const modelId = element.getAttribute('data-model-id');
    const productsData = element.getAttribute('data-products');
    
    try {
        // Use the new safeDecode function
        const products = safeDecode(productsData);
        if (products) {
            showModelDetails(modelId, products);
        } else {
            throw new Error('Failed to decode products data');
        }
    } catch (error) {
        console.error('Error handling model click:', error);
        // Show error to user
        PopupUtil.showAlert({
            title: 'Error',
            message: 'Failed to load model details',
            type: 'error'
        });
    }
}

// Update loadProductMeasurements to use filteredProducts if provided
async function loadProductMeasurements(modelId, filteredProducts = null) {
    console.log('=== START MEASUREMENT LOADING ===');
    console.log('Loading measurements for ModelId:', modelId);
    
    const tableContainer = document.getElementById('measurements-table');
    tableContainer.style.opacity = '0.5';

    try {
        // Get model specifications
        console.log('1. Fetching specifications...');
        const specs = await ModelSpecificationService.getSpecifications(modelId);
        console.log('1.1 Specifications received:', specs);

        // Use filtered products if provided, otherwise fetch from server
        const products = filteredProducts || await ProductService.getProductsByModelId(modelId);
        console.log('2. Products:', products);

        // Building table HTML
        console.log('3. Building table HTML...');
        let tableHTML = `
            <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="table-header">STT</th>
                        <th class="table-header">Mold Number</th>
                        <th class="table-header">Time</th>`;

        specs.forEach(spec => {
            tableHTML += `
                <th class="table-header">
                    ${spec.SpecName} (${spec.Unit})
                </th>`;
        });

        tableHTML += `</tr></thead><tbody class="bg-white divide-y divide-gray-200">`;

        if (products && products.length > 0) {
            console.log('4. Processing measurements...');
            products.forEach((product, index) => {
                console.log(`4.1 Processing product ${index + 1}:`, product);
                const measurements = product.Measurements || [];
                console.log(`4.2 Measurements for product ${index + 1}:`, measurements);

                tableHTML += `
                    <tr>
                        <td class="table-cell-base text-gray-900">${index + 1}</td>
                        <td class="table-cell-base text-gray-900">${product.MoldNumber || '--'}</td>
                        <td class="table-cell-base text-gray-900">
                            ${new Date(product.MeasurementDate + 'Z').toLocaleString() || '--'}
                        </td>`;

                specs.forEach(spec => {
                    const measurement = measurements.find(m => m.SpecId === spec.SpecId);
                    const value = measurement ? measurement.Value.toFixed(2) : '--';
                    const isWithinRange = measurement ? 
                        (measurement.Value >= spec.MinValue && measurement.Value <= spec.MaxValue) : 
                        true;

                    const rangeClass = isWithinRange ? 'in-range' : 'out-of-range';

                    tableHTML += `
                        <td class="measurement-cell ${rangeClass}">
                            ${value}
                        </td>`;
                });

                tableHTML += `</tr>`;
            });
        } else {
            tableHTML += `
                <tr>
                    <td colspan="${3 + specs.length}" class="table-cell-base text-gray-500 text-center">
                        No measurement data available for this model
                    </td>
                </tr>`;
        }

        tableHTML += `</tbody></table>`;
        tableContainer.innerHTML = tableHTML;
        
        console.log('=== END MEASUREMENT LOADING ===');

    } catch (error) {
        console.error('=== ERROR IN MEASUREMENT LOADING ===');
        console.error('Error details:', error);
        tableContainer.innerHTML = `
            <div class="text-red-600 p-4">Error loading measurements: ${error.message}</div>`;
    }
    tableContainer.style.opacity = '1';
}

// Add this function to load molds for a specific model
async function loadMoldsForModel(modelId) {
    try {
        // Get all products for this model
        const products = await ProductService.getProductsByModelId(modelId);
        console.log('📦 Got products for mold filtering:', products);

        // Extract unique mold numbers
        const uniqueMolds = [...new Set(products
            .map(p => p.MoldNumber)
            .filter(mold => mold && mold.trim() !== ''))] // Filter out empty/null values
            .sort((a, b) => a.localeCompare(b)); // Sort alphabetically

        console.log('🔧 Unique molds found:', uniqueMolds);

        const $moldFilter = $('#moldFilter');
        $moldFilter.empty();
        
        // Add "All Molds" option
        $moldFilter.append($('<option>', {
            value: '',
            text: 'All Molds'
        }));
        
        // Add each unique mold
        uniqueMolds.forEach(mold => {
            $moldFilter.append($('<option>', {
                value: mold,
                text: mold
            }));
        });

        // Reinitialize Select2
        $moldFilter.select2('destroy');
        $moldFilter.select2({
            width: '100%',
            minimumResultsForSearch: uniqueMolds.length > 10 ? 0 : -1,
            templateResult: function(data) {
                return $('<span>' + data.text + '</span>');
            },
            templateSelection: function(data) {
                return $('<span>' + data.text + '</span>');
            }
        });

        console.log('🔧 Mold select updated with', uniqueMolds.length, 'options (plus All Molds)');
    } catch (error) {
        console.error('❌ Error loading molds:', error);
        showToast(error.message, 'error');
    }
}

// Update the modelFilter change handler
$('#modelFilter').on('change', async function() {
    const modelId = $(this).val();
    console.log('🔄 Model filter changed:', modelId);
    
    if (modelId) {
        await loadMoldsForModel(modelId);
    } else {
        // Reset mold filter if no model is selected
        const $moldFilter = $('#moldFilter');
        $moldFilter.empty().append($('<option>', {
            value: '',
            text: 'All Molds'
        }));
        $moldFilter.trigger('change');
    }
    
    // Apply filters after model change
    await applyFilters();
});

// Update mold filter change handler
$('#moldFilter').on('change', async function() {
    console.log('🔄 Mold filter changed:', $(this).val());
    // Apply filters after mold change
    await applyFilters();
});

// Initialize everything when the page loads
document.addEventListener('DOMContentLoaded', () => {
    // Initialize filters (which includes model filter)
    initializeFilters();
    
    // Initialize clock
    function updateClock() {
        const now = new Date();
        $('#clock').text(now.toLocaleTimeString());
        $('#date').text(now.toLocaleDateString());
    }
    
    setInterval(updateClock, 1000);
    updateClock();
    
    // Load initial data
    applyFilters();
});

// Add these variables at the top of the file
let currentModelId = null;
let currentMoldNumber = null;

// Update showModelDetails function to store current model and mold
async function showModelDetails(modelId, filteredProducts) {
    currentModelId = modelId;
    currentMoldNumber = currentFilters.moldNumber || '';
    
    document.getElementById('summaryView').classList.add('hidden');
    document.getElementById('detailView').classList.remove('hidden');
    
    await loadProductMeasurements(modelId, filteredProducts);
}

// Add the export handler function
async function handleExportToExcel() {

    currentMoldNumber = await showMoldSelectionModal(currentModelId);
    
    if (!currentMoldNumber) {
        await PopupUtil.showAlert({
            title: 'Missing Mold',
            message: 'Please select a mold number first',
            type: 'warning'
        });
        
        return;
    }

    console.log('Starting export with:', { currentModelId, currentMoldNumber });

    // Remove any existing modal first
    removeModal();

    // Create and show export modal
    const modal = createModal();
    modal.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
            <div id="exportStatus" class="space-y-4">
                <div class="flex items-center space-x-4">
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    <p class="text-lg">Exporting to Excel...</p>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    try {
        console.log('🔄 Starting export for:', { currentModelId, currentMoldNumber });
        const result = await ExcelService.exportMeasurementByModelAndMold(currentModelId, currentMoldNumber);
        
        console.log('Export result:', result);
        
        // Update modal content for success
        const statusDiv = modal.querySelector('#exportStatus');
        statusDiv.innerHTML = `
            <div class="text-center space-y-4">
                <div class="text-green-500 mb-4">
                    <svg class="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <h3 class="text-xl font-semibold text-gray-900">Export Successful!</h3>
                <p class="text-gray-600">Your report has been generated successfully.</p>
                <div class="flex justify-center space-x-3 mt-4">
                    <button onclick="handleSaveFile('${result.tempFilePath}', '${result.fileName}')" 
                            class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                        Save File
                    </button>
                    <button onclick="removeModal()" 
                            class="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50">
                        Close
                    </button>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Export error:', error);
        // Update modal content for error
        const statusDiv = modal.querySelector('#exportStatus');
        statusDiv.innerHTML = `
            <div class="text-center space-y-4">
                <div class="text-red-500 mb-4">
                    <svg class="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </div>
                <h3 class="text-xl font-semibold text-gray-900">Export Failed</h3>
                <p class="text-red-600">${error.message || 'Unknown error occurred'}</p>
                <button onclick="removeModal()" 
                        class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 mt-4">
                    Close
                </button>
            </div>
        `;
    }
}

// Add this function to handle modal content updates
function updateModalContent(modal, type, data) {
    const statusDiv = modal.querySelector('#exportStatus');
    
    if (type === 'success') {
        statusDiv.innerHTML = `
            <div class="text-center space-y-4">
                <div class="text-green-500 mb-4">
                    <svg class="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <h3 class="text-xl font-semibold text-gray-900">Export Successful!</h3>
                <p class="text-gray-600">Your report has been generated successfully.</p>
                <div class="flex justify-center space-x-3 mt-4">
                    <button onclick="handleSaveFile('${data.tempFilePath}', '${data.fileName}')" 
                            class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                        Save File
                    </button>
                    <button onclick="removeModal()" 
                            class="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50">
                        Close
                    </button>
                </div>
            </div>
        `;
    } else {
        statusDiv.innerHTML = `
            <div class="text-center space-y-4">
                <div class="text-red-500 mb-4">
                    <svg class="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </div>
                <h3 class="text-xl font-semibold text-gray-900">Export Failed</h3>
                <p class="text-red-600">${data.message || 'Unknown error occurred'}</p>
                <button onclick="removeModal()" 
                        class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 mt-4">
                    Close
                </button>
            </div>
        `;
    }
}

// Add this function to handle file saving
async function handleSaveFile(tempFilePath, defaultFileName) {
    try {
        // Extract just the filename from the path
        const fileName = tempFilePath.split('\\').pop().split('/').pop();
        const saveResult = await ExcelService.saveExcelFile(fileName, defaultFileName);
        if (saveResult) {
            updateModalContent(document.getElementById('exportModal'), 'success-save', saveResult);
        }
    } catch (error) {
        console.error('Save error:', error);
        updateModalContent(document.getElementById('exportModal'), 'error', error);
    }
}

// Add this function to handle save success
function updateModalContent(modal, type, data) {
    const statusDiv = modal.querySelector('#exportStatus');
    
    switch (type) {
        case 'success':
            // ... (previous success case)
            break;
        
        case 'success-save':
            statusDiv.innerHTML = `
                <div class="text-center space-y-4">
                    <div class="text-green-500 mb-4">
                        <svg class="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h3 class="text-xl font-semibold text-gray-900">File Saved!</h3>
                    <p class="text-gray-600">The file has been saved to:</p>
                    <p class="text-sm text-gray-500 break-all">${data.path}</p>
                    <button onclick="removeModal()" 
                            class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 mt-4">
                        Close
                    </button>
                </div>
            `;
            break;
            
        case 'error':
            statusDiv.innerHTML = `
                <div class="text-center space-y-4">
                    <div class="text-red-500 mb-4">
                        <svg class="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </div>
                    <h3 class="text-xl font-semibold text-gray-900">Error</h3>
                    <p class="text-red-600">${data.message || 'Unknown error occurred'}</p>
                    <button onclick="removeModal()" 
                            class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 mt-4">
                        Close
                    </button>
                </div>
            `;
            break;
    }
}

// Function to create and show mold selection modal
async function showMoldSelectionModal(modelId) {
    // Remove any existing modal first
    removeModal();

    try {
        // Get products for this model to extract mold numbers
        const products = await ProductService.getProductsByModelId(modelId);
        
        // Extract unique mold numbers
        const uniqueMolds = [...new Set(products
            .map(p => p.MoldNumber)
            .filter(mold => mold && mold.trim() !== ''))]
            .sort((a, b) => a.localeCompare(b));

        // Create modal
        const modal = createModal();
        modal.innerHTML = `
            <div class="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
                <h3 class="text-lg font-semibold mb-4">Select Mold Number</h3>
                <div class="mb-4">
                    <select id="moldSelectModal" class="w-full p-2 border rounded">
                        <option value="">Select a mold number...</option>
                        ${uniqueMolds.map(mold => `
                            <option value="${mold}">${mold}</option>
                        `).join('')}
                    </select>
                </div>
                <div class="flex justify-end space-x-3">
                    <button onclick="removeModal()" 
                            class="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50">
                        Cancel
                    </button>
                    <button id="confirmMoldSelection"
                            class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                        Confirm
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Initialize Select2 for better UX
        $('#moldSelectModal').select2({
            dropdownParent: modal,
            width: '100%',
            placeholder: 'Select a mold number',
            allowClear: true
        });

        // Return a promise that resolves with selected mold number
        return new Promise((resolve, reject) => {
            document.getElementById('confirmMoldSelection').addEventListener('click', () => {
                const selectedMold = $('#moldSelectModal').val();
                if (selectedMold) {
                    removeModal();
                    resolve(selectedMold);
                } else {
                    // Show error if no mold selected
                    PopupUtil.showAlert({
                        title: 'Selection Required',
                        message: 'Please select a mold number',
                        type: 'warning'
                    });
                }
            });

            // Handle modal close/cancel
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    removeModal();
                    resolve(null);
                }
            });
        });
    } catch (error) {
        console.error('Error showing mold selection modal:', error);
        await PopupUtil.showAlert({
            title: 'Error',
            message: 'Failed to load mold numbers: ' + error.message,
            type: 'error'
        });
        return null;
    }
}


// Add this to your DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', () => {
    // ... existing initialization code ...

    // Add export button event listener
    document.getElementById('exportToExcel').addEventListener('click', handleExportToExcel);
});

// Update the modal close handler in handleExportToExcel
function closeModal() {
    const existingModal = document.querySelector('.modal-container');
    if (existingModal) {
        existingModal.remove();
    }
}

