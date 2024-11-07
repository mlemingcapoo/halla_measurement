
document.addEventListener('DOMContentLoaded', function () {
    console.log("Settings modal loaded");
    setInterval(updateClock, 1000);
    updateClock();
});

// Initialize clock
function updateClock() {
    const now = new Date();
    $('#clock').text(now.toLocaleTimeString());
    $('#date').text(now.toLocaleDateString());
}
loadModels();
// Tab switching
console.log("Initializing tab switching");

// Add this function after your other functions
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');

    // Set classes based on type
    const baseClasses = 'flex items-center p-4 mb-4 rounded-lg shadow-lg transition-all duration-500 transform translate-x-full';
    const typeClasses = type === 'success'
        ? 'text-green-800 bg-green-50 dark:bg-gray-800 dark:text-green-400'
        : 'text-red-800 bg-red-50 dark:bg-gray-800 dark:text-red-400';

    toast.className = `${baseClasses} ${typeClasses}`;

    // Add icon based on type
    const icon = type === 'success'
        ? '<svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg>'
        : '<svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path></svg>';

    toast.innerHTML = `
        ${icon}
        <span class="text-sm font-semibold">${message}</span>
    `;

    container.appendChild(toast);

    // Animate in
    setTimeout(() => {
        toast.classList.remove('translate-x-full');
    }, 10);

    // Remove after 3 seconds
    setTimeout(() => {
        toast.classList.add('translate-x-full');
        setTimeout(() => {
            container.removeChild(toast);
        }, 500);
    }, 3000);
}

function handleSpecificationsTabClick() {
    const modelSelect = document.getElementById('specifications-model-select');
    if (modelSelect && modelSelect.value) {
        // If there's a selected model, load its specifications
        loadSpecifications(modelSelect.value);
    }
}

// Update your existing tab switching code
document.querySelectorAll('.tab-button').forEach(button => {

    button.addEventListener('click', (e) => {
        console.log("Tab button found");
        // Update button styles
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('border-blue-500', 'text-blue-600');
            btn.classList.add('text-gray-500');
        });
        button.classList.remove('text-gray-500');
        button.classList.add('border-blue-500', 'text-blue-600');

        // Show corresponding tab content
        const tabId = button.getAttribute('data-tab');
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.add('hidden');
        });

        const targetTab = document.getElementById(`${tabId}-tab`);
        if (targetTab) {
            targetTab.classList.remove('hidden');
            console.log("Target tab found");
            // If switching to specifications tab, trigger specifications load
            if (tabId === 'specifications') {
                handleSpecificationsTabClick();
            }
        }
    });
});

// Function to switch to specs tab and select model
function switchToSpecs(modelId) {
    // Switch to specifications tab
    document.querySelector('[data-tab="specifications"]').click();

    // Select the model in the dropdown
    const modelSelects = document.querySelectorAll('select');
    modelSelects.forEach(select => {
        select.value = modelId;
    });
}

async function editModel(modelId) {
    try {
        console.log('Starting editModel with modelId:', modelId);
        const model = await ModelService.getModelById(modelId);
        console.log('Retrieved model data:', model);

        const form = document.getElementById('model-form');
        const formTitle = document.getElementById('form-title');
        const imagePreview = document.getElementById('image-preview');
        const imageUpload = document.getElementById('image-upload');

        // Populate basic form fields
        form.querySelector('[name="modelCode"]').value = model.ModelCode;
        form.querySelector('[name="modelName"]').value = model.ModelName;
        form.querySelector('[name="description"]').value = model.Description || '';

        // Clear existing preview
        imagePreview.innerHTML = '';
        console.log('Checking for images:', model.Images);

        // Create a DataTransfer object for the file input
        const dataTransfer = new DataTransfer();

        // Load existing images
        if (model.Images && model.Images.length > 0) {
            console.log(`Found ${model.Images.length} images to load`);

            for (const image of model.Images) {
                console.log('Processing image:', image);

                // Create preview container
                const container = document.createElement('div');
                container.className = 'relative group';
                container.dataset.imageId = image.ImageId;

                container.innerHTML = `
                    <img src="${image.FilePath}" class="w-full h-32 object-cover rounded-lg" />
                    <button type="button" 
                            class="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity" 
                            onclick="deleteModelImage(${image.ImageId})">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                `;
                imagePreview.appendChild(container);
                console.log('Added preview container for image:', image.FileName);

                // Fetch the image and create a File object
                try {
                    console.log('Fetching image from:', image.FilePath);
                    const response = await fetch(image.FilePath);
                    console.log('Fetch response:', response);
                    const blob = await response.blob();
                    const file = new File([blob], image.FileName, {
                        type: image.ContentType
                    });
                    dataTransfer.items.add(file);
                    console.log('Successfully added file to DataTransfer:', file.name);
                } catch (error) {
                    console.error('Error loading image:', error);
                }
            }

            // Update the file input with existing files
            imageUpload.files = dataTransfer.files;
            console.log('Updated file input with', dataTransfer.files.length, 'files');
        } else {
            console.log('No images found for this model');
        }

        // Set editing state
        form.dataset.editing = modelId;
        formTitle.textContent = `Edit Model: ${model.ModelCode}`;
        console.log('Completed editModel setup');

    } catch (error) {
        console.error('Error in editModel:', error);
        showToast('Error loading model: ' + error.message, 'error');
    }
}

// Add this function to your script section
function initNewModel() {
    const form = document.getElementById('model-form');
    const formTitle = document.getElementById('form-title');

    // Clear the form
    form.reset();

    // Remove editing state if exists
    delete form.dataset.editing;

    // Update title
    formTitle.textContent = 'Create New Model';

    // Optional: Show a toast
    showToast('Sẵn sàng thêm model mới');

    // Optional: Focus the first input
    form.querySelector('[name="modelCode"]').focus();

    // image clear
    document.getElementById('image-preview').innerHTML = '';
}

// Image upload preview with multiple image support
document.getElementById('image-upload').addEventListener('change', function (e) {
    const preview = document.getElementById('image-preview');
    const files = e.target.files;

    // Clear preview if no files selected
    if (files.length === 0) {
        preview.innerHTML = '';
        return;
    }

    // Process each selected file
    [...files].forEach(file => {
        // Create container for image and remove button
        const container = document.createElement('div');
        container.className = 'relative group';

        // Create image preview
        const reader = new FileReader();
        reader.onload = function (e) {
            // Create image element
            const img = document.createElement('img');
            img.src = e.target.result;
            img.className = 'w-full h-32 object-cover rounded-lg';

            // Create remove button
            const removeBtn = document.createElement('button');
            removeBtn.className = 'absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity';
            removeBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            `;

            // Add remove functionality
            removeBtn.onclick = function (e) {
                e.preventDefault();
                container.remove();

                // Update the file input
                const dt = new DataTransfer();
                const input = document.getElementById('image-upload');
                const { files } = input;

                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    if (file !== this.file) dt.items.add(file);
                }

                input.files = dt.files;
            };

            // Add image and remove button to container
            container.appendChild(img);
            container.appendChild(removeBtn);
            preview.appendChild(container);
        };

        reader.readAsDataURL(file);
    });
});

// Load all models when modal opens
async function loadModels() {
    try {
        const models = await ModelService.getAllModels();
        const modelList = document.querySelector('#models-tab .overflow-y-auto .space-y-4');
        modelList.innerHTML = ''; // Clear existing items

        for (const model of models) {
            const modelElement = document.createElement('div');
            modelElement.className = 'border rounded-lg p-4 hover:bg-gray-50';
            modelElement.innerHTML = `
                <div class="flex justify-between items-start mb-2">
                    <h4 class="font-semibold">${model.ModelCode}</h4>
                    <div class="space-x-2">
                        <button class="text-blue-600 hover:text-blue-800" onclick="editModel(${model.ModelId})">Edit</button>
                        <button class="text-blue-600 hover:text-blue-800" onclick="switchToSpecs(${model.ModelId})">Edit Specs</button>
                        <button class="text-red-600 hover:text-red-800" onclick="deleteModel(${model.ModelId})">Delete</button>
                    </div>
                </div>
                <p class="text-sm text-gray-600">${model.Description || 'No description'}</p>
            `;
            modelList.appendChild(modelElement);
        }

        // Also update the model dropdowns in specifications tab
        updateModelDropdowns(models);
    } catch (error) {
        console.error('Error loading models:', error);
    }
}

// Update model dropdowns in specifications tab
function updateModelDropdowns(models) {
    const selects = document.querySelectorAll('#specifications-tab select');
    selects.forEach(select => {
        const currentValue = select.value;
        select.innerHTML = '';
        models.forEach(model => {
            select.innerHTML += `<option value="${model.ModelId}">${model.ModelCode}</option>`;
        });
        if (currentValue) select.value = currentValue;
    });
}

// Update the model form submission handler
document.getElementById('model-form').addEventListener('submit', async function (e) {
    e.preventDefault();

    try {
        const modelCode = this.querySelector('[name="modelCode"]').value;
        const modelName = this.querySelector('[name="modelName"]').value;
        const description = this.querySelector('[name="description"]').value;
        const imageFiles = document.getElementById('image-upload').files;

        if (!modelCode || !modelName) {
            showToast('Model Code and Name are required', 'error');
            return;
        }

        let modelId;

        if (this.dataset.editing) {
            // Update existing model
            modelId = parseInt(this.dataset.editing);
            // Convert images to base64
            const images = await Promise.all(Array.from(imageFiles).map(async file => {
                const base64 = await convertFileToBase64(file);
                return {
                    fileName: file.name,
                    base64Image: base64,
                    contentType: file.type
                };
            }));

            await ModelService.updateModel({
                ModelId: modelId,
                modelCode: modelCode,
                modelName: modelName,
                description: description,
                images: images
            });
            showToast('Model updated successfully');
            delete this.dataset.editing;
        } else {
            // Create new model first
            const newModel = await ModelService.createModel({
                modelCode: modelCode,
                modelName: modelName,
                description: description,
                createdAt: new Date().toISOString(),
                totalProducts: 0
            });

            // If there are images, update the model with images
            if (imageFiles.length > 0) {
                const images = await Promise.all(Array.from(imageFiles).map(async file => {
                    const base64 = await convertFileToBase64(file);
                    return {
                        fileName: file.name,
                        base64Image: base64,
                        contentType: file.type
                    };
                }));

                // Update the newly created model with images
                await ModelService.updateModel({
                    ModelId: newModel.ModelId,
                    modelCode: modelCode,
                    modelName: modelName,
                    description: description,
                    createdAt: newModel.CreatedAt,
                    totalProducts: 0,
                    images: images
                });
            }

            showToast('Model created successfully');
        }

        this.reset();
        document.getElementById('image-preview').innerHTML = '';
        await loadModels();
    } catch (error) {
        console.error('Error saving model:', error);
        const errorMessage = error.error || error.message || 'Unknown error occurred';
        showToast(errorMessage, 'error');
    }
});

// Add helper function for base64 conversion
function convertFileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64String = reader.result.split(',')[1];
            resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Update the editSpecification function
async function editSpecification(specId) {
    try {
        const spec = await ModelSpecificationService.getSpecificationById(specId);
        const form = document.getElementById('spec-form');
        const formTitle = document.getElementById('spec-form-title');

        // Populate form
        form.querySelector('[name="modelId"]').value = spec.ModelId;
        form.querySelector('[name="specName"]').value = spec.SpecName;
        form.querySelector('[name="minValue"]').value = spec.MinValue;
        form.querySelector('[name="maxValue"]').value = spec.MaxValue;
        form.querySelector('[name="unit"]').value = spec.Unit || '';

        // Set editing state
        form.dataset.editing = specId;

        // Update title
        formTitle.textContent = `Edit Specification: ${spec.SpecName}`;

        // Update submit button
        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.textContent = 'Update Specification';

        // Optional: Scroll form into view
        form.scrollIntoView({ behavior: 'smooth' });

        // Optional: Show toast
        showToast('Editing specification: ' + spec.SpecName);

    } catch (error) {
        console.error('Error loading specification for edit:', error);
        showToast('Error loading specification: ' + error.message, 'error');
    }
}

// Update the initNewSpecification function
function initNewSpecification() {
    const form = document.getElementById('spec-form');
    const formTitle = document.getElementById('spec-form-title');

    // Clear the form
    form.reset();

    // Remove editing state if exists
    delete form.dataset.editing;

    // Update title
    formTitle.textContent = 'Create New Specification';

    // Reset button text
    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.textContent = 'Save Specification';

    // Keep the modelId if it exists in the dropdown
    const modelSelect = document.querySelector('#specifications-tab select[name="modelId"]');
    if (modelSelect.value) {
        form.querySelector('[name="modelId"]').value = modelSelect.value;
    }
}

// Update the spec form submission handler
document.getElementById('spec-form').addEventListener('submit', async function (e) {
    e.preventDefault();

    try {
        const specData = {
            modelId: parseInt(this.querySelector('[name="modelId"]').value),
            specName: this.querySelector('[name="specName"]').value,
            minValue: parseFloat(this.querySelector('[name="minValue"]').value),
            maxValue: parseFloat(this.querySelector('[name="maxValue"]').value),
            unit: this.querySelector('[name="unit"]').value,
            displayOrder: 0
        };

        if (this.dataset.editing) {
            // Update existing specification
            const specId = parseInt(this.dataset.editing);
            await ModelSpecificationService.updateSpecification({
                specId: specId,  // Changed from SpecId to specId to match the service
                ...specData
            });
            showToast('Specification updated successfully');
            delete this.dataset.editing;
        } else {
            // Create new specification
            await ModelSpecificationService.createSpecification(specData);
            showToast('Specification created successfully');
        }

        // Reset form and reload specifications
        initNewSpecification();
        await loadSpecifications(specData.modelId);
    } catch (error) {
        console.error('Error saving specification:', error);
        showToast(error.message || 'Error saving specification', 'error');
    }
});

// Update the loadSpecifications function (around line 524)
async function loadSpecifications(modelId) {
    try {
        const specs = await ModelSpecificationService.getSpecifications(modelId);
        const specList = document.querySelector('#specifications-tab .overflow-y-auto .space-y-4');
        specList.innerHTML = '';

        specs.forEach(spec => {
            const specElement = document.createElement('div'); // Add this line
            specElement.className = 'border rounded-lg p-4 hover:bg-gray-50'; // Add this line

            specElement.innerHTML = `
                <div class="flex justify-between items-center">
                    <div>
                        <h4 class="font-semibold">${spec.SpecName}</h4>
                        <p class="text-sm text-gray-600">Min: ${spec.MinValue} | Max: ${spec.MaxValue} ${spec.Unit || ''}</p>
                    </div>
                    <div class="space-x-2">
                        <button onclick="editSpecification(${spec.SpecId})" 
                                class="text-blue-600 hover:text-blue-800">
                            Edit
                        </button>
                        <button onclick="deleteSpecification(${spec.SpecId})" 
                                class="text-red-600 hover:text-red-800">
                            Delete
                        </button>
                    </div>
                </div>
            `;
            specList.appendChild(specElement);
        });
    } catch (error) {
        console.error('Error loading specifications:', error);
        showToast('Error loading specifications: ' + error.message, 'error');
    }
}

async function editModel(modelId) {
    try {
        console.log('1. Starting editModel with modelId:', modelId);

        const model = await ModelService.getModelById(modelId);
        console.log('2. Retrieved model data:', model);

        const form = document.getElementById('model-form');
        const formTitle = document.getElementById('form-title');
        const imagePreview = document.getElementById('image-preview');
        const imageUpload = document.getElementById('image-upload');

        console.log('3. Found DOM elements:', {
            form: !!form,
            formTitle: !!formTitle,
            imagePreview: !!imagePreview,
            imageUpload: !!imageUpload
        });

        // Populate basic form fields
        form.querySelector('[name="modelCode"]').value = model.ModelCode;
        form.querySelector('[name="modelName"]').value = model.ModelName;
        form.querySelector('[name="description"]').value = model.Description || '';

        // Clear existing preview
        imagePreview.innerHTML = '';
        console.log('4. Checking for images:', model.Images);

        // Create a DataTransfer object for the file input
        const dataTransfer = new DataTransfer();
        console.log('5. Created DataTransfer object');

        // Load existing images
        if (model.Images && model.Images.length > 0) {
            console.log('6. Processing images:', model.Images);

            for (const image of model.Images) {
                console.log('7. Processing image:', image);
                try {
                    // Create preview container
                    const container = document.createElement('div');
                    container.className = 'relative group';
                    container.dataset.imageId = image.ImageId;

                    // Use window.location.origin to ensure correct path
                    const imagePath = `${window.location.origin}${image.FilePath}`;
                    console.log('8. Full image path:', imagePath);

                    container.innerHTML = `
                            <img src="${imagePath}" 
                                 alt="${image.FileName}"
                                 class="w-full h-32 object-cover rounded-lg"
                                 onerror="console.error('Failed to load image:', '${imagePath}')" />
                            <button onclick="deleteModelImage(${image.ImageId})" 
                                    class="absolute top-2 right-2 bg-red-500 text-white p-1 rounded opacity-0 group-hover:opacity-100">
                                Delete
                            </button>
                        `;

                    imagePreview.appendChild(container);
                } catch (error) {
                    console.error('Error processing image:', error);
                }
            }
        } else {
            console.log('No images found. Model.Images:', model.Images);
        }

        // Set editing state
        form.dataset.editing = modelId;
        formTitle.textContent = `Edit Model: ${model.ModelCode}`;
        console.log('15. Completed editModel setup');

    } catch (error) {
        console.error('Error in editModel:', error);
        showToast('Error loading model: ' + error.message, 'error');
    }
}

// Add function to delete model image
async function deleteModelImage(imageId) {
    try {
        if (!confirm('Are you sure you want to delete this image?')) return;
        await ModelService.deleteModelImage(imageId);
        showToast('Image deleted successfully');

        // Refresh the current model being edited
        const form = document.getElementById('model-form');
        if (form.dataset.editing) {
            await editModel(parseInt(form.dataset.editing));
        }
    } catch (error) {
        console.error('Error deleting image:', error);
        showToast('Error deleting image: ' + error.message, 'error');
    }
}

// Function to delete model
async function deleteModel(modelId) {
    try {
        if (!confirm('Are you sure you want to delete this model?')) return;

        await ModelService.deleteModel(modelId);
        await loadModels();
    } catch (error) {
        console.error('Error deleting model:', error);
        alert('Error deleting model: ' + error.message);
    }
}

// Function to delete specification
async function deleteSpecification(specId) {
    try {
        if (!confirm('Are you sure you want to delete this specification?')) return;

        await ModelSpecificationService.deleteSpecification(specId);
        // Refresh the specifications list
        const modelId = document.querySelector('#specifications-tab [name="modelId"]').value;
        if (modelId) {
            await loadSpecifications(modelId);
        }
    } catch (error) {
        console.error('Error deleting specification:', error);
        alert('Error deleting specification: ' + error.message);
    }
}

// Add after deleteSpecification()

// Function to switch to specs tab and select model
function switchToSpecs(modelId) {
    // Switch to specifications tab
    const specsTab = document.querySelector('[data-tab="specifications"]');
    specsTab.click();

    // Select the model in the dropdown and load its specifications
    const modelSelect = document.querySelector('#specifications-tab [name="modelId"]');
    modelSelect.value = modelId;
    loadSpecifications(modelId);

    // Also update the hidden input in the form
    document.querySelector('#spec-form [name="modelId"]').value = modelId;
}

// Initialize when modal opens
document.addEventListener('DOMContentLoaded', loadModels);

console.log("test");

// Add this after your existing functions
async function handleImageUpload(event) {
    console.log('🖼️ [Upload] Starting image upload process');
    const files = event.target.files;
    console.log(`🖼️ [Upload] Number of files selected: ${files.length}`);

    try {
        const modelId = parseInt(document.getElementById('model-form').dataset.editing);
        if (!modelId) {
            throw new Error('No model ID found. Please save the model first.');
        }
        console.log(`🖼️ [Upload] Uploading for ModelId: ${modelId}`);

        for (const file of files) {
            console.log(`🖼️ [Upload] Processing file: ${file.name} (${file.type})`);

            // Read file as base64
            const base64 = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(file);
            });
            console.log('🖼️ [Upload] File converted to base64');

            const imageData = {
                modelId: modelId,
                base64Image: base64,
                fileName: file.name,
                contentType: file.type,
                displayOrder: 0 // You might want to calculate this based on existing images
            };
            console.log('🖼️ [Upload] Created image data object:', {
                ...imageData,
                base64Image: base64.substring(0, 50) + '...' // Truncate for logging
            });

            // Create the image
            await createModelImage(imageData);
            console.log('🖼️ [Upload] Image uploaded successfully');

            // Debug check images after upload
            await ModelService.debugCheckImages();

            // Refresh the model display
            await editModel(modelId);
            console.log('🖼️ [Upload] Model display refreshed');
        }

        showToast('Images uploaded successfully', 'success');
    } catch (error) {
        console.error('🖼️ [Upload] Error:', error);
        showToast('Hãy tạo model trước rồi cập nhật ảnh', 'error');
    }
}

// Helper function to create model image
async function createModelImage(imageData) {
    return new Promise((resolve, reject) => {
        try {
            console.log('🖼️ [Create] Sending image creation request');
            window.electronAPI.send('image-create', JSON.stringify(imageData));

            window.electronAPI.receive('image-created', (result) => {
                console.log('🖼️ [Create] Image created successfully');
                resolve(JSON.parse(result));
            });

            window.electronAPI.receive('image-error', (error) => {
                console.error('🖼️ [Create] Error creating image:', error);
                reject(JSON.parse(error));
            });
        } catch (error) {
            console.error('🖼️ [Create] Critical error:', error);
            reject(error);
        }
    });
}

// Add a debug function to check images
async function debugCheckImagesForModel(modelId) {
    try {
        console.log('🔍 [Debug] Checking images for model:', modelId);

        // Check database state
        const dbState = await ModelService.debugCheckImages();
        console.log('🔍 [Debug] Database state:', dbState);

        // Get model details
        const model = await ModelService.getModelById(modelId);
        console.log('🔍 [Debug] Model details:', model);

        // Check image files
        if (model.Images && model.Images.length > 0) {
            console.log('🔍 [Debug] Checking image files...');
            for (const image of model.Images) {
                try {
                    const response = await fetch(image.FilePath);
                    console.log(`🔍 [Debug] Image ${image.ImageId} (${image.FilePath}):`, {
                        exists: response.ok,
                        status: response.status,
                        type: response.headers.get('content-type')
                    });
                } catch (error) {
                    console.error(`🔍 [Debug] Error checking image ${image.ImageId}:`, error);
                }
            }
        } else {
            console.log('🔍 [Debug] No images found for this model');
        }
    } catch (error) {
        console.error('🔍 [Debug] Error during debug check:', error);
    }
}
