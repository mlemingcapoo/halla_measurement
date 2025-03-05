window.electronAPI.receive('command-error', (errorMessage) => {
    console.error('Command error:', errorMessage);
    showToast(errorMessage, 'error', 10000);
});

window.electronAPI.receive('command-success', (successMessage) => {
    // console.log('Command success:', successMessage);
    showToast(successMessage, 'success', 3000);
});

window.electronAPI.receive('status-received', (statusMessage) => {
    // console.log('Status received:', statusMessage);
    showToast(statusMessage, 'info', 10000);
});

function closeApp() {
    // console.log("closing");
    window.electronAPI.closeApp();
    // console.log("closeApp done");
}

// Add these functions after initializeModelSelect
function saveSelectedModel(modelId) {
    localStorage.setItem('selectedModelId', modelId);
    // console.log('Saved selected model:', modelId);
}

function loadSelectedModel() {
    const savedModelId = localStorage.getItem('selectedModelId');
    // console.log('Loaded saved model:', savedModelId);
    return savedModelId;
}
// console.log("test from index ");
// Replace the existing event listener with this
// Replace the existing model change event handler (around line 275)
$('#modelSelect').on('change', async function () {
    const modelId = $(this).val();
    if (!modelId) return;

    try {
        // Save the selected model
        saveSelectedModel(modelId);
        // console.log('🔄 Model selected:', modelId);

        // Update model details and images
        await updateModelDetails(modelId);

        // Refresh measurements table
        await refreshMeasurementsTable();

    } catch (error) {
        console.error('Error handling model change:', error);
        showToast(error.message, 'error');
    }
});

// $('#refreshMeasurementsBtn').on('click', async function () {
//     location.reload();
// });

async function loadProductMeasurements(modelId, products = null, processName = null) {
    const tableContainer = document.getElementById('measurements-table');
    tableContainer.style.transition = 'opacity 0.2s';
    tableContainer.style.opacity = '0.5';

    if (!modelId) {
        return;
    }

    try {
        // Get model specifications
        const allSpecs = await ModelSpecificationService.getSpecifications(modelId);
        
        // Filter specs by process if specified
        const specs = processName && processName !== 'ALL'
            ? allSpecs.filter(spec => spec.ProcessName === processName)
            : allSpecs;

        // If products weren't passed, fetch them
        if (!products) {
            products = await ProductService.getProductsByModelId(modelId);
        }

        // Building table HTML
        let tableHTML = `
            <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-2 py-3 text-center text-xs font-medium text-gray-900 uppercase tracking-wider" style="width: 50px;">STT</th>
                        <th class="px-2 py-3 text-center text-xs font-medium text-gray-900 uppercase tracking-wider" style="width: 100px;">Mold</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">Time</th>`;

        // Add spec headers - only for filtered specs
        specs.forEach(spec => {
            tableHTML += `
                <th class="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
                    ${spec.SpecName} (${spec.Unit})
                </th>`;
        });

        tableHTML += `</tr></thead><tbody class="bg-white divide-y divide-gray-200">`;

        // Update chart if we have data
        if (products && products.length > 0) {
            updateMeasurementChart(products, specs);
        }

        // Add rows
        if (products && products.length > 0) {
            products.forEach((product, index) => {
                const measurements = product.Measurements || [];

                // Check if all measurements for this product are empty
                const hasAnyMeasurement = specs.some(spec => 
                    measurements.some(m => m.SpecId === spec.SpecId)
                );

                // Skip this row if all measurements are empty
                if (!hasAnyMeasurement) {
                    return; // Skip to next product
                }

                tableHTML += `<tr>
                    <td class="px-2 py-4 whitespace-nowrap text-sm text-center text-gray-900" style="width: 10px;">${index + 1}</td>
                    <td class="px-2 py-4 whitespace-nowrap text-sm text-center text-gray-900" style="width: 10px;">${product.MoldNumber || '--'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900" style="width: 10px;">
                        ${new Date(product.MeasurementDate + 'Z').toLocaleString() || '--'}
                    </td>`;

                // Add measurement values - only for filtered specs
                specs.forEach(spec => {
                    const measurement = measurements.find(m => m.SpecId === spec.SpecId);
                    const value = measurement ? measurement.Value.toFixed(2) : '--';
                    const isWithinRange = measurement ? 
                        (measurement.Value >= spec.MinValue && measurement.Value <= spec.MaxValue) : 
                        true;

                    const bgColorClass = isWithinRange ? 'bg-green-200' : 'bg-red-200';
                    const textColorClass = isWithinRange ? 'text-green-900' : 'text-red-900';

                    tableHTML += `
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium ${measurement ? `${bgColorClass} ${textColorClass}` : ''}">
                            ${value}
                        </td>`;
                });

                tableHTML += `</tr>`;
            });

            // If no rows were added after filtering (all products had empty measurements)
            if (!tableHTML.includes('</tr>')) {
                tableHTML += `
                    <tr>
                        <td colspan="${3 + specs.length}" class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                            No measurement data available
                        </td>
                    </tr>`;
            }
        } else {
            tableHTML += `
                <tr>
                    <td colspan="${3 + specs.length}" class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                        No measurement data available
                    </td>
                </tr>`;
        }

        tableHTML += `</tbody></table>`;
        
        // Set the table HTML
        tableContainer.innerHTML = tableHTML;
        tableContainer.style.opacity = '1';

    } catch (error) {
        console.error('Error loading measurements:', error);
        tableContainer.innerHTML = `
            <div class="text-red-600 p-4">Error loading measurements: ${error.message}</div>
        `;
        tableContainer.style.opacity = '1';
    }
}


// Replace the existing refreshMeasurementsTable function
async function refreshMeasurementsTable() {
    try {
        const modelId = $('#modelSelect').val();
        const selectedMold = $('#moldSelect').val();
        
        if (modelId) {
            // Show loading state
            const tableContainer = document.getElementById('measurements-table');
            tableContainer.innerHTML = `
                <div class="flex items-center justify-center p-4">
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                    <span class="ml-2">Loading measurements...</span>
                </div>
            `;

            // Initialize empty chart first
            initEmptyChart();
            
            // Get all products for the model
            const allProducts = await ProductService.getProductsByModelId(modelId);
            
            // Filter products by mold if selected
            const filteredProducts = selectedMold 
                ? allProducts.filter(p => p.MoldNumber === selectedMold)
                : allProducts;

            // console.log('📊 Filtered products:', {
            //     total: allProducts.length,
            //     filtered: filteredProducts.length,
            //     selectedMold
            // });

            // Load the measurements with filtered products
            await loadProductMeasurements(modelId, filteredProducts);
        }
    } catch (error) {
        console.error(' Error refreshing measurements:', error);
        showToast('Error refreshing data: ' + error.message, 'error');
        
        const tableContainer = document.getElementById('measurements-table');
        tableContainer.innerHTML = `
            <div class="text-center py-4 text-red-600">
                <p>Error loading measurements. Please try again.</p>
            </div>
        `;
    }
}


async function initializeModelSelect() {
    const select = document.getElementById('modelSelect');

    try {
        const models = await ModelService.getAllModels();
        models.sort((a, b) => a.PartNo.localeCompare(b.PartNo));

        // Initial population with PartNo - PartName format
        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.ModelId;
            option.textContent = `${model.PartNo} - ${model.PartName}`;
            select.appendChild(option);
        });

        // Initialize Select2
        $(select).select2({
            placeholder: 'Select Model',
            allowClear: false,
            width: '100%',
            dropdownParent: select.parentElement,
            minimumResultsForSearch: 1,
            searchPlaceholder: 'Search...',
            templateResult: function (data) {
                if (!data.id) return data.text;
                return $('<span class="font-semibold">' + data.text + '</span>');
            }
        });

        // Initialize Mold Select with default "All Molds" option
        const $moldSelect = $('#moldSelect');
        $moldSelect.empty();
        $moldSelect.append(new Option('All Molds', ''));
        
        // Initialize Select2 for mold select
        $moldSelect.select2({
            placeholder: 'Select Mold',
            allowClear: true,
            width: '100%',
            minimumResultsForSearch: -1,
            templateResult: function(data) {
                if (!data.id) { // This is the "All Molds" option
                    return $('<span class="font-semibold text-gray-600">All Molds</span>');
                }
                return $('<span>' + data.text + '</span>');
            }
        });

        // Load saved model or select first model
        const savedModelId = loadSelectedModel();
        if (savedModelId && models.some(m => m.ModelId.toString() === savedModelId)) {
            select.value = savedModelId;
        } else if (models.length > 0) {
            select.value = models[0].ModelId;
            saveSelectedModel(models[0].ModelId);
        }

        // Update model images and details
        if (select.value) {
            await updateModelDetails(select.value);
            await loadMoldsForModel(select.value); // Load molds for initial model
        }

        // Then trigger the change event
        $(select).trigger('change');

    } catch (error) {
        console.error('Error loading models:', error);
        showToast(error.message, 'error');
    }
}

async function refreshModelList() {
    const select = document.getElementById('modelSelect');
    const currentSelectedId = select.value;
    const currentHTML = select.innerHTML;

    try {
        const models = await ModelService.getAllModels();
        const newHTML = models.map(model =>
            `<option value="${model.ModelId}">${model.PartNo} - ${model.PartName}</option>`
        ).join('');
        if (newHTML !== currentHTML) {
            models.sort((a, b) => a.PartNo.localeCompare(b.PartNo));

            // Store existing options for comparison
            const existingOptions = Array.from(select.options).map(opt => ({
                value: opt.value,
                text: opt.textContent
            }));

            // Check if there are any changes
            const hasChanges = models.length !== existingOptions.length ||
                models.some(model => !existingOptions.find(opt =>
                    opt.value === model.ModelId.toString() && 
                    opt.text === `${model.PartNo} - ${model.PartName}`
                ));

            if (hasChanges) {
                // Clear existing options
                select.innerHTML = '<option value="">Select Model</option>';

                // Populate new options
                models.forEach(model => {
                    const option = document.createElement('option');
                    option.value = model.ModelId;
                    option.textContent = `${model.PartNo} - ${model.PartName}`;
                    select.appendChild(option);
                });

                // Reinitialize Select2
                $(select).select2('destroy');
                $(select).select2({
                    placeholder: 'Select Model',
                    allowClear: false,
                    width: '100%',
                    dropdownParent: select.parentElement,
                    minimumResultsForSearch: 5,
                    templateResult: function (data) {
                        if (!data.id) return data.text;
                        return $('<span class="font-semibold">' + data.text + '</span>');
                    }
                });

                // Restore previous selection if it still exists
                if (currentSelectedId && models.some(m => m.ModelId.toString() === currentSelectedId)) {
                    select.value = currentSelectedId;
                    $(select).trigger('change');
                } else if (models.length > 0) {
                    select.value = models[0].ModelId;
                    saveSelectedModel(models[0].ModelId);
                    $(select).trigger('change');
                }
            }
        }
    } catch (error) {
        console.error('Error refreshing models:', error);
    }
}

// Add this at the top of your script section
window.services = {
    modelSpec: null,
    productSpec: null,
    initialized: false
};

// Update the initializeServices function
async function initializeServices() {
    if (window.services.initialized) return;

    try {
        // Instead of creating instances, use the static classes directly
        window.services.modelSpec = ModelSpecificationService;
        window.services.productSpec = ProductSpecificationService;
        window.services.initialized = true;
        // console.log('Services initialized successfully');
    } catch (error) {
        console.error('Failed to initialize services:', error);
        throw error;
    }
}

// Update the openModal function
async function openModal(modalId, title, size = 'max-w-lg') {
    console.log('🔒 Checking authentication for modal:', modalId);
    
    // Check if modal requires authentication
    const protectedModals = ['measurement'];
    if (protectedModals.includes(modalId) && !AuthService.isAuthenticated()) {
        console.log('🚫 Authentication required for modal:', modalId);
        LoginHandler.showLoginModal();
        return;
    }

    console.log('🔓 Opening modal:', modalId);
    
    // Initialize services if needed
    if (modalId === 'measurement' && !window.services.initialized) {
        await initializeServices();
    }

    const modal = document.getElementById('modal');
    const modalContainer = document.getElementById('modal-container');
    const modalContent = document.getElementById('modal-content-container');

    try {
        const response = await fetch(`./modals/${modalId}-modal.html`);
        if (!response.ok) throw new Error('Modal content not found');

        const htmlContent = await response.text();
        modalContent.innerHTML = htmlContent;

        // Execute scripts
        const scripts = modalContent.getElementsByTagName('script');
        Array.from(scripts).forEach(script => {
            const newScript = document.createElement('script');
            Array.from(script.attributes).forEach(attr => {
                newScript.setAttribute(attr.name, attr.value);
            });
            newScript.textContent = script.textContent;
            script.parentNode.replaceChild(newScript, script);
        });

        modal.classList.remove('hidden');
        modal.querySelector('h3').textContent = title;
        modalContainer.className = `bg-white rounded-lg p-6 w-full ${size}`;
    } catch (error) {
        console.error('Error loading modal:', error);
        modalContent.innerHTML = 'Error loading modal content';
    }
}

function closeModal() {
    // const modal = document.getElementById('modal');
    // const modalContent = document.getElementById('modal-content-container');

    // // Cleanup any intervals from measurement process
    // if (window.measurementForm && window.measurementForm.countdownInterval) {
    //     clearInterval(window.measurementForm.countdownInterval);
    // }

    // // Check if we're closing a product-related modal
    // const isProductModal = modalContent.querySelector('#measurement-form') ||
    //     modalContent.querySelector('#product-form') ||
    //     modalContent.getAttribute('data-modal') === 'measurement';

    // // Clear the content container
    // modalContent.innerHTML = '';
    // modal.classList.add('hidden');

    // // Refresh table if it was a product modal
    // setTimeout(() => {  // Add small delay to ensure modal is fully closed
    //     refreshMeasurementsTable();
    //     refreshModelList();
    // }, 1);
    // Force page reload after a short delay to ensure cleanup is complete
    setTimeout(() => {
        location.reload();
    }, 100);
}

// Update clock
function updateClock() {
    requestAnimationFrame(() => {
        const now = new Date();
        $('#clocktime').text(now.toLocaleTimeString());
        $('#datetime').text(now.toLocaleDateString());
    });
}

function updateTotalProducts() {
    // Get all products without model filter
    ProductService.getAllProducts()
        .then(products => {
            const totalProducts = products ? products.length : 0;
            document.getElementById('totalProducts').textContent = totalProducts;
        })
        .catch(error => {
            console.error('Error updating total products:', error);
            document.getElementById('totalProducts').textContent = '-';
        });
}
// set to total product text to loading first
document.getElementById('totalProducts').textContent = 'loading...';
setInterval(updateClock, 1000);
updateClock();
// setInterval(updateTotalProducts, 5000); // Update every 5 seconds
updateTotalProducts();

document.querySelectorAll('button[data-modal]').forEach(button => {
    button.addEventListener('click', async (e) => {
        console.log('🔘 Modal button clicked:', button.getAttribute('data-modal'));
        if (button.getAttribute('onclick') === 'closeModal()') return;

        const modalId = button.getAttribute('data-modal');

        const modalSizes = {
            'home': 'max-w-7xl',
            'settings': 'max-w-5xl',
            'reports': 'max-w-6xl',
            'history': 'max-w-3xl',
            'hardware': 'max-w-xl',
            'measurement': 'max-w-8xl',
        };

        await openModal(modalId, button.textContent.trim(), modalSizes[modalId] || 'max-w-lg');
    });
});
// document.addEventListener('DOMContentLoaded', initializeModelSelect);
// Initialize the measurement form
// const measurementForm = new MeasurementForm();

// Add this function after initializeModelSelect
async function updateModelDetails(modelId) {
    try {
        const model = await ModelService.getModelById(modelId);
        if (!model) {
            console.error('❌ No model data received');
            return;
        }

        // Update total products count first
        const products = await ProductService.getProductsByModelId(modelId);
        const totalProducts = products?.length || 0;
        document.getElementById('totalProducts').textContent = totalProducts;

        // Get image grid element
        const imageGrid = document.querySelector('.model-images-grid');
        if (!imageGrid) {
            console.error('❌ Image grid element not found');
            return;
        }

        // Show loading placeholder immediately
        imageGrid.innerHTML = `
            <div class="text-center py-4 text-gray-500 col-span-2">
                <div class="animate-pulse flex space-x-4 justify-center items-center">
                    <div class="rounded-full bg-slate-200 h-10 w-10"></div>
                    <div class="flex-1 space-y-6 py-1 max-w-[200px]">
                        <div class="h-2 bg-slate-200 rounded"></div>
                        <div class="space-y-3">
                            <div class="grid grid-cols-3 gap-4">
                                <div class="h-2 bg-slate-200 rounded col-span-2"></div>
                                <div class="h-2 bg-slate-200 rounded col-span-1"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Load images asynchronously
        if (model.Images && model.Images.length > 0) {
            // Create a promise for each image load
            const imageLoadPromises = model.Images.map((img, index) => {
                return new Promise((resolve) => {
                    if (!img.Base64Data) {
                        resolve('');
                        return;
                    }

                    const base64Data = img.Base64Data.replace(/^data:.*?;base64,/, '');
                    const imgSrc = `data:${img.ContentType || 'image/jpeg'};base64,${base64Data}`;
                    
                    // Create image element to test loading
                    const image = new Image();
                    image.onload = () => {
                        resolve(`
                            <img src="${imgSrc}" 
                                alt="${img.FileName || `Model View ${index + 1}`}" 
                                class="rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer"
                                loading="lazy"
                            >
                        `);
                    };
                    image.onerror = () => {
                        resolve(`
                            <img src="../images/placeholder.png" 
                                alt="Failed to load image ${index + 1}" 
                                class="rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer"
                            >
                        `);
                    };
                    image.src = imgSrc;
                });
            });

            // Load images in parallel
            Promise.all(imageLoadPromises).then(imageHTMLs => {
                const validImages = imageHTMLs.filter(html => html !== '');
                if (validImages.length > 0) {
                    imageGrid.innerHTML = validImages.join('');
                } else {
                    imageGrid.innerHTML = `
                        <div class="text-center py-4 text-gray-500">
                            <p class="font-medium">No valid images found</p>
                        </div>
                    `;
                }
            });
        } else {
            imageGrid.innerHTML = `
                <div class="text-center py-4 text-gray-500">
                    <p class="font-medium">No images available</p>
                </div>
            `;
        }

        // Update specifications if needed
        if (window.measurementForm) {
            await window.measurementForm.initializeForModel(modelId);
        }

    } catch (error) {
        console.error('❌ Error updating model details:', error);
        if (error.message !== 'undefined') {
            showToast(`Error loading model details: ${error.message}`, 'error');
        }
    }
}

// Update the loadMoldsForModel function
async function loadMoldsForModel(modelId) {
    try {
        if (!modelId) {
            console.warn('⚠️ No modelId provided to loadMoldsForModel');
            return;
        }

        // console.log('🚀 loadMoldsForModel called with modelId:', modelId);
        
        const products = await ProductService.getProductsByModelId(modelId);
        // console.log('📦 Retrieved products:', products);
        
        const uniqueMolds = [...new Set(products
            .map(p => p.MoldNumber)
            .filter(mold => mold && mold.trim() !== ''))]
            .sort();
        
        // console.log('🔍 Unique molds:', uniqueMolds);

        const $moldSelect = $('#moldSelect');
        $moldSelect.empty();

        // Add "All Molds" option with empty value
        $moldSelect.append(new Option('All Molds', '', true, true));
        
        // Add individual mold options
        uniqueMolds.forEach(mold => {
            $moldSelect.append(new Option(mold, mold, false, false));
        });

        // console.log('✅ Mold select updated with All Molds option');
        
        // Reset to "All Molds" and trigger change
        $moldSelect.val('').trigger('change');

        // Reinitialize Select2 with custom template
        $moldSelect.select2({
            placeholder: 'Select Mold',
            allowClear: true,
            width: '80px !important',
            minimumResultsForSearch: -1,
            templateResult: function(data) {
                if (!data.id) { // This is the "All Molds" option
                    return $('<span class="font-semibold text-gray-600">All Molds</span>');
                }
                return $('<span>' + data.text + '</span>');
            },
            templateSelection: function(data) {
                if (!data.id) { // This is the "All Molds" option
                    return $('<span class="font-semibold">All Molds</span>');
                }
                return $('<span>' + data.text + '</span>');
            }
        });
    } catch (error) {
        console.error('❌ Error loading molds:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack
        });
    }
}

// Update the model change handler
$('#modelSelect').on('change', async function() {
    const modelId = $(this).val();
    if (!modelId) return;

    try {
        saveSelectedModel(modelId);
        await loadMoldsForModel(modelId);
        await updateModelDetails(modelId);
        
        // Reset process select to 'LQC' instead of 'ALL'
        setTimeout(() => {
            $('#processSelect').val('LQC').trigger('change');
        }, 100);
        
        await refreshMeasurementsTable();
    } catch (error) {
        console.error('Error handling model change:', error);
        showToast(error.message, 'error');
    }
});

// Add mold change handler
$('#moldSelect').on('change', async function() {
    const modelId = $('#modelSelect').val();
    const moldNumber = $(this).val();
    const processName = $('#processSelect').val();

    if (modelId) {
        const products = moldNumber 
            ? await ProductService.getProductsByModelAndMold(modelId, moldNumber)
            : await ProductService.getProductsByModelId(modelId);

        await loadProductMeasurements(modelId, products, processName);
    }
});

// Update refreshMeasurementsTable to include mold filter
async function refreshMeasurementsTable() {
    const modelId = $('#modelSelect').val();
    const moldNumber = $('#moldSelect').val();
    
    if (modelId) {
        initEmptyChart();
        const products = await ProductService.getProductsByModelAndMold(modelId, moldNumber);
        await loadProductMeasurements(modelId, products);
    }
}



// Thêm các event listeners cho model và mold select
$(document).ready(function() {
    $('#modelSelect').select2();
    $('#moldSelect').select2();
    initializeProcessSelect();

    ModelService.getAllModels().then(async models => {
        const select = $('#modelSelect');
        models.forEach(model => {
            select.append(new Option(`${model.PartNo} - ${model.PartName}`, model.ModelId));
        });

        select.val('').trigger('change');

        setTimeout(async () => {
            const savedModelId = localStorage.getItem('selectedModelId');
            
            if (savedModelId && models.some(m => m.ModelId.toString() === savedModelId)) {
                select.val(savedModelId).trigger('change');
                
                const products = await ProductService.getProductsByModelId(savedModelId);
                await loadProductMeasurements(savedModelId, products);
                await loadMoldsForModel(savedModelId);
            }
        }, 100);
    });

    $('#modelSelect').on('change', async function() {
        const modelId = $(this).val();
        if (modelId) {
            const products = await ProductService.getProductsByModelId(modelId);
            await loadProductMeasurements(modelId, products);
            await loadMoldsForModel(modelId);
        }
    });

    $('#moldSelect').on('change', async function() {
        const modelId = $('#modelSelect').val();
        const moldNumber = $(this).val();
        if (modelId) {
            const products = await ProductService.getProductsByModelAndMold(modelId, moldNumber);
            await loadProductMeasurements(modelId, products);
        }
    });

    
});

async function loadMoldsForModel(modelId) {
    try {
        if (!modelId) {
            console.warn('⚠️ No modelId provided to loadMoldsForModel');
            return;
        }

        // console.log('🚀 loadMoldsForModel called with modelId:', modelId);
        
        const products = await ProductService.getProductsByModelId(modelId);
        // console.log('📦 Retrieved products:', products);
        
        const uniqueMolds = [...new Set(products
            .map(p => p.MoldNumber)
            .filter(mold => mold && mold.trim() !== ''))]
            .sort();
        
        // console.log('🔍 Unique molds:', uniqueMolds);

        const $moldSelect = $('#moldSelect');
        $moldSelect.empty();

        // Add "All Molds" option with empty value
        $moldSelect.append(new Option('All Molds', '', true, true));
        
        // Add individual mold options
        uniqueMolds.forEach(mold => {
            $moldSelect.append(new Option(mold, mold, false, false));
        });

        // console.log('✅ Mold select updated with All Molds option');
        
        // Reset to "All Molds" and trigger change
        $moldSelect.val('').trigger('change');

        // Reinitialize Select2 with custom template
        $moldSelect.select2({
            placeholder: 'Select Mold',
            allowClear: true,
            width: '80px !important',
            minimumResultsForSearch: -1,
            templateResult: function(data) {
                if (!data.id) { // This is the "All Molds" option
                    return $('<span class="font-semibold text-gray-600">All Molds</span>');
                }
                return $('<span>' + data.text + '</span>');
            },
            templateSelection: function(data) {
                if (!data.id) { // This is the "All Molds" option
                    return $('<span class="font-semibold">All Molds</span>');
                }
                return $('<span>' + data.text + '</span>');
            }
        });
    } catch (error) {
        console.error('❌ Error loading molds:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack
        });
    }
}
// Add this function after loadMoldsForModel
function initializeProcessSelect() {
    const $processSelect = $('#processSelect');
    $processSelect.empty();
    
    // Add only CNC and DC options
    const processes = ['IQC', 'LQC', 'OQC'];
    processes.forEach(process => {
        $processSelect.append(new Option(process, process));
    });

    // Select DC by default
    $processSelect.val('LQC').trigger('change');

    // Initialize Select2
    $processSelect.select2({
        placeholder: 'Select Process',
        allowClear: false,
        width: '80px !important',
        minimumResultsForSearch: -1,
        templateResult: function(data) {
            return $('<span>' + data.text + '</span>');
        },
        templateSelection: function(data) {
            return $('<span>' + data.text + '</span>');
        }
    });
}

// Add process change handler
$('#processSelect').on('change', async function() {
    const modelId = $('#modelSelect').val();
    const moldNumber = $('#moldSelect').val();
    const processName = $(this).val();

    if (modelId) {
        let products;
        if (moldNumber) {
            products = await ProductService.getProductsByModelAndMold(modelId, moldNumber);
        } else {
            products = await ProductService.getProductsByModelId(modelId);
        }
        
        await loadProductMeasurements(modelId, products, processName);
    }
});

// Update refreshMeasurementsTable to include process filter
async function refreshMeasurementsTable() {
    const modelId = $('#modelSelect').val();
    const moldNumber = $('#moldSelect').val();
    const processName = $('#processSelect').val();
    
    if (modelId) {
        initEmptyChart();
        let products;
        if (moldNumber) {
            products = await ProductService.getProductsByModelAndMold(modelId, moldNumber);
        } else {
            products = await ProductService.getProductsByModelId(modelId);
        }
        await loadProductMeasurements(modelId, products, processName);
    }
}