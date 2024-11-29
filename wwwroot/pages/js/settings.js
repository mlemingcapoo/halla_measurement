let selectedModelId = null;

$(document).ready(function () {
    console.log('🚀 Page loaded, initializing...');

    // Verify all required elements exist
    const requiredElements = {
        modelModal: $('#model-modal'),
        specModal: $('#spec-modal'),
        modelForm: $('#model-form'),
        specForm: $('#spec-form'),
        modelsList: $('#models-list'),
        specsList: $('#specs-list'),
        modelSearch: $('#model-search'),
        specSearch: $('#spec-search')
    };

    // Check for missing elements
    const missingElements = Object.entries(requiredElements)
        .filter(([_, element]) => element.length === 0)
        .map(([name]) => name);

    if (missingElements.length > 0) {
        console.error('❌ Missing required elements:', missingElements);
        return;
    }
    console.log('✅ All required elements found');

    // Initialize page
    initializePage();
    setupEventListeners();

    // Set up modal close on background click
    const $modals = $('.modal');
    console.log('🔍 Found modals:', $modals.length);

    $modals.on('click', function (e) {
        if (e.target === this) {
            $(this).addClass('hidden');
        }
    });

    // Add click handlers for modal open buttons
    const $modelButton = $('#new-model-btn');
    const $specButton = $('#new-spec-btn');
    const $importExcelButton = $('#import-excel-btn');

    if ($modelButton.length && $specButton.length) {
        console.log('✅ Found modal trigger buttons');

        $modelButton.on('click', () => {
            console.log('👆 New Model button clicked');
            showModelForm('create');
        });

        $specButton.on('click', () => {
            console.log('👆 New Specification button clicked');
            showSpecForm('create');
        });

        $importExcelButton.on('click', () => {
            console.log('👆 Import Excel button clicked');
            showImportExcelModal();
        });
    } else {
        console.error('❌ Modal trigger buttons not found');
    }

    // Initialize spec button state
    updateSpecButtonState();

    // Initialize document upload handler
    $('#document-upload').on('change', handleDocumentUpload);

    // Disable file input if there's already an image
    const $imageUpload = $('#image-upload');
    const $preview = $('#image-preview');
    
    if ($preview.children().length > 0) {
        $imageUpload.prop('disabled', true);
    }

    // Add change event listener for image upload
    $imageUpload.on('change', handleImageUpload);

    window.electronAPI.receive('import-excel-done', (result) => {
        // show Toasts
        showToast(JSON.parse(result).success, 'success');
    });
});

// Page Initialization
function initializePage() {
    updateClock();
    setInterval(updateClock, 1000);
    loadModels();
    
    // Add auto-refresh for models list
    setInterval(async () => {
        // Only refresh if we're not in the middle of an operation
        if (!$('#model-modal').is(':visible') && !$('#spec-modal').is(':visible')) {
            console.log('🔄 Auto-refreshing models list...');
            await loadModels();
        }
    }, 5000);
}

// Clock Functions
function updateClock() {
    const now = new Date();
    $('#clock').text(now.toLocaleTimeString());
    $('#date').text(now.toLocaleDateString());
}

// Event Listeners Setup
function setupEventListeners() {
    console.log('🎯 Setting up event listeners...');

    // Model search with 2 second debounce
    $('#model-search').on('input', function (e) {
        console.log('🔍 Search input detected:', $(this).val());
        filterModels($(this).val());
    });

    // Spec search
    $('#spec-search').on('input', function (e) {
        console.log('🔍 Spec search input detected:', $(this).val());
        filterSpecs($(this).val());
    });

    // Form submissions
    $('#model-form').on('submit', function (e) {
        e.preventDefault();
        handleModelSubmit(e);
    });

    $('#spec-form').on('submit', function (e) {
        e.preventDefault();
        handleSpecSubmit(e);
    });

    // Equipment form submission
    $('#equip-form').on('submit', function (e) {
        e.preventDefault();
        handleEquipSubmit(e);
    });

    // Log that event listeners are set up
    console.log('✅ Event listeners set up successfully');

    // Add Equipment button click handler
    $('#add-equip-btn').on('click', function () {
        showEquipModal();
    });

    $('#browseExcelFolder').on('click', async () => {
        $('#browseExcelFolder').prop('disabled', true);
        console.log('👆 Browse Excel Folder button clicked');
    
        // Define a handler for the folder-selected event
        const folderSelectedHandler = (folderPath) => {
            console.log('👆 Received folder-selected message:', folderPath);
            $('#folderPicker').val(folderPath);
            $('#scanFolderBtn').removeClass('hidden');
            scanFolder();
    
            // Remove the event listener after handling the event
            window.electronAPI.receive('folder-selected', folderSelectedHandler); // RemoveListener equivalent for your context bridge
        };
    
        // Attach the handler
        window.electronAPI.receive('folder-selected', folderSelectedHandler);
    
        // Trigger the folder selection
        await window.electronAPI.send('choose-folder');
        console.log('👆 Sent choose-folder message');
    
        $('#browseExcelFolder').prop('disabled', false);
    });
    

    $('#scanFolderBtn').on('click', async () => {
        console.log('👆 Scan Folder button clicked');
        scanFolder();
    });

    $('#importSelectedFilesBtn').on('click', async () => {
        console.log('👆 Import Selected Files button clicked');
        importSelectedFiles();
    });

    $('#resetModalBtn').on('click', () => {
        console.log('👆 Reset Modal button clicked');
        resetImportExcelModal();
    });

    // Delete Equipment button click handler
    $('#delete-equip-btn').on('click', async function () {
        const $select = $('#spec-form [name="equipName"]');
        const selectedEquip = $select.find('option:selected');
        const equipName = selectedEquip.text();
        const equipId = selectedEquip.data('equip-id');

        if (!equipId || !equipName || equipName === 'Select Equipment') {
            showToast('Please select an equipment to delete', 'error');
            return;
        }

        const result = await PopupUtil.showConfirm({
            title: 'Xóa thiết bị',
            message: `Xóa "${equipName}" cũng sẽ xóa nó khỏi các SPECs sử dụng nó.`,
            type: 'danger',
            confirmButtonText: 'Xóa',
            cancelButtonText: 'Hủy'
        });

        if (result) {
            try {
                await ModelSpecificationService.deleteEquipment(equipId);
                showToast('Equipment deleted successfully');
                await loadEquipmentOptions();
            } catch (error) {
                showToast(error.message, 'error');
            }
        }
    });

    window.electronAPI.receive('excel-file-error', (error) => {
        showToast(JSON.parse(error).error, 'error');
    });

    // Add to your setupEventListeners function
    $('#select-all-files').on('change', function () {
        const isChecked = $(this).prop('checked');
        $('.file-checkbox').prop('checked', isChecked);
    });

    // Update select-all state when individual checkboxes change
    $(document).on('change', '.file-checkbox', function () {
        const allChecked = $('.file-checkbox:checked').length === $('.file-checkbox').length;
        $('#select-all-files').prop('checked', allChecked);
    });

    // excel-file-success
    window.electronAPI.receive('excel-file-success', (successMessage) => {
        showToast(JSON.parse(successMessage).success, 'success');
    });
}

async function importSelectedFiles() {
    console.log('👆 Importing selected files');
    const selectedFiles = $('.file-checkbox:checked').map(function () {
        return {
            FileName: $(this).data('file-name'),
            PartNo: $(this).data('part-no')
        };
    }).get();
    if (selectedFiles.length === 0) {
        showToast('Please select at least one file to import', 'error');
        return;
    }
    console.log('Selected files:', selectedFiles);
    // send selected files to backend
    window.electronAPI.receive('import-selected-files-result', (result) => {
        console.log('👆 Received import-selected-files-result message:', result);
        showToast(result, 'success');
    });

    // Create and show import loading modal
    const modalHtml = `
        <div id="importLoadingModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-[200]">
            <div class="relative p-8 bg-white rounded-lg shadow-xl max-w-md mx-auto">
                <div class="flex flex-col items-center">
                    <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
                    <h3 class="text-lg font-semibold text-gray-900">Đang nhập dữ liệu</h3>
                </div>
            </div>
        </div>
    `;
    
    // Add modal to body if it doesn't exist
    if (!$('#importLoadingModal').length) {
        $('body').append(modalHtml);
    }
    
    // Show modal
    $('#importLoadingModal').removeClass('hidden');

    window.electronAPI.receive('import-excel-done', (result) => {
        // Hide and remove modal
        $('#importLoadingModal').addClass('hidden').remove();
        // Refresh page after success
        // wait 3 sec before reload
        setTimeout(() => {
            window.location.reload();
        }, 500);
    });

    window.electronAPI.send('import-selected-files', JSON.stringify(selectedFiles));
}



async function scanFolder() {
    console.log('👆 Scanning folder');
    $('#loadingCircle').removeClass('hidden');
    $('#fileTable').addClass('hidden');
    window.electronAPI.receive('excel-folder-scanned', (files) => {
        const parsedFiles = JSON.parse(files);
        console.log('👆 Received excel-folder-scanned message:', parsedFiles);
        $('#fileTableBody').empty();
        parsedFiles.forEach(file => {
            if (file.FileName && file.PartNo) {
                $('#fileTableBody').append(`
                    <tr>
                        <td class="p-2">
                            <label class="flex items-center space-x-2 cursor-pointer">
                                <input type="checkbox" 
                                    class="file-checkbox w-5 h-5" 
                                    data-part-no="${file.PartNo}"
                                    data-file-name="${file.FileName}">
                                <span class="ml-2 text-gray-700">${file.PartNo}</span>
                            </label>
                        </td>
                        <td class="p-2">${file.FileName}</td>
                        <!-- <td class="p-2">${file.PartNo}</td> -->
                    </tr>
                `);
            }
        });
        $('#fileTable').removeClass('hidden');
        $('#loadingCircle').addClass('hidden');
        $('#importSelectedFilesBtn').removeClass('hidden');
        $('#after-scan-text').removeClass('hidden');
        $('#before-scan-text').addClass('hidden');
    });
    await window.electronAPI.send('scan-excel-folder', $('#folderPicker').val());
}

// Modal Functions
function showModelForm(mode, modelId = null) {
    console.log('🔵 Showing model form:', { mode, modelId });
    const $modal = $('#model-modal');
    const $form = $('#model-form');
    const $title = $('#model-form-title');
    const $preview = $('#image-preview');

    $form[0].reset();

    // Only clear preview if it's not edit mode
    if (mode !== 'edit') {
        $preview.empty();
    }

    // Remove any previous cloning note
    $form.find('.text-gray-600.bg-gray-100').remove();

    switch (mode) {
        case 'edit':
            $title.text('Edit Model');
            $form.data('editing', modelId);
            break;
        case 'clone':
            $title.text('Clone Model');
            $form.removeData('editing');
            break;
        default:
            $title.text('Create New Model');
            $form.removeData('editing');
            $form.removeData('cloning-from');
    }

    $modal.removeClass('hidden');
}

function showImportExcelModal() {
    console.log('🔵 Showing import excel modal');
    $('#import-excel-modal').removeClass('hidden');


}

function showSpecForm(mode, specId = null) {
    const $modal = $('#spec-modal');
    const $form = $('#spec-form');
    const $title = $('#spec-form-title');

    $form[0].reset();

    // Set the hidden model ID to the currently selected model
    $form.find('[name="modelId"]').val(selectedModelId);

    // Load equipment options
    loadEquipmentOptions();

    if (mode === 'edit' && specId) {
        $title.text('Edit Specification');
        $form.data('editing', specId);
    } else {
        $title.text('Create New Specification');
        $form.removeData('editing');
    }

    $modal.removeClass('hidden');
}

function closeImportExcelModal() {
    $('#import-excel-modal').addClass('hidden');
}

function resetImportExcelModal() {
    $('#after-scan-text').addClass('hidden');
    $('#before-scan-text').removeClass('hidden');
    $('#fileTable').addClass('hidden');
    $('#loadingCircle').addClass('hidden');
    $('#importSelectedFilesBtn').addClass('hidden');
    $('#fileTableBody').empty();
}

function closeModelModal() {
    $('#model-modal').addClass('hidden');
    // Refresh specifications list if a model is selected
    if (selectedModelId) {
        loadSpecifications(selectedModelId);
    }
}

function closeSpecModal() {
    $('#spec-modal').addClass('hidden');
    // Refresh specifications list if a model is selected
    if (selectedModelId) {
        loadSpecifications(selectedModelId);
    }
}

// Model Functions
async function loadModels() {
    try {
        const models = await ModelService.getAllModels();
        const $modelsList = $('#models-list');
        
        // Store scroll position
        const scrollPosition = $modelsList.scrollTop();
        
        $modelsList.empty();

        if (models.length === 0) {
            $modelsList.html(`
                <div class="text-center py-8 text-gray-500">
                    <p class="font-medium">Không có model nào, hãy bấm (+) để thêm mới</p>
                </div>
            `);
        } else {
            models.forEach(model => {
                const modelElement = createModelListItem(model);
                $modelsList.append(modelElement);
            });
        }

        // Restore scroll position
        $modelsList.scrollTop(scrollPosition);

        updateModelDropdown(models);
        updateSpecButtonState();
        
        // If we have a selected model, make sure it's still highlighted
        if (selectedModelId) {
            const selectedModel = models.find(m => m.ModelId === selectedModelId);
            if (selectedModel) {
                $(`.list-item[data-model-id="${selectedModelId}"]`)
                    .addClass('border-orange-500 border-2 translate-x-5 bg-orange-50');
            } else {
                // If the selected model no longer exists, clear the selection
                selectedModelId = null;
                $('#specs-list').empty();
                updateSpecButtonState();
            }
        }
    } catch (error) {
        console.error('Error loading models:', error);
        showToast(error.message, 'error');
    }
}

function createModelListItem(model) {
    const div = $('<div class="list-item border rounded-lg p-4 cursor-pointer transition-all duration-200"></div>')
        .attr('data-model-id', model.ModelId);

    // Add initial selected state if this is the selected model
    if (selectedModelId === model.ModelId) {
        div.addClass('border-orange-500 border-2 translate-x-5 bg-orange-50');
    }

    // Debug log for images
    console.log('🖼️ Model images data:', {
        modelId: model.ModelId,
        hasImages: !!model.Images?.length,
        firstImage: model.Images?.[0],
        imageDetails: model.Images?.[0] ? {
            id: model.Images[0].ImageId,
            fileName: model.Images[0].FileName,
            hasBase64: !!model.Images[0].Base64Data,
            contentType: model.Images[0].ContentType
        } : null
    });

    // Create the content with image
    const hasImage = model.Images && model.Images.length > 0;
    let imageHtml;

    if (hasImage) {
        const firstImage = model.Images[0];
        // Use the same base64 handling as loadModelForEdit
        const base64Data = firstImage.Base64Data.startsWith('data:')
            ? firstImage.Base64Data
            : `data:${firstImage.ContentType};base64,${firstImage.Base64Data}`;

        imageHtml = `
            <div class="flex-shrink-0" style="margin-right: 14px; width: 100px; height: 100px;">
                <img src="${base64Data}"
                     class="w-full h-full object-cover rounded-lg bg-gray-100 shadow-md"
                     alt="${firstImage.FileName}"
                     onerror="console.error('Failed to load image:', '${firstImage.FileName}')"
                >
            </div>
        `;
    } else {
        imageHtml = `
            <div class="flex-shrink-0 flex items-center rounded-lg justify-center shadow-md" style="margin-right: 14px; width: 100px; height: 100px;">
                <span class="text-gray-500 text-xs">No IMG</span>
            </div>
        `;
    }

    // Add click handler for selection
    div.on('click', async (e) => {
        console.log('🎯 Model clicked:', model.ModelId);

        // Prevent triggering when clicking edit/delete buttons
        if (e.target.closest('button')) {
            console.log('⚡ Button clicked, ignoring selection');
            return;
        }

        // Only handle selection if it's a different model
        if (selectedModelId !== model.ModelId) {
            console.log('✨ Selecting model:', model.ModelId);
            // Remove selection from previously selected model
            const previousSelected = $('.list-item.border-orange-500');
            if (previousSelected.length > 0) {
                console.log('🔄 Removing previous selection');
                previousSelected.removeClass('border-orange-500 border-2 translate-x-5 bg-orange-50');
            }

            // Add selection to current model
            div.addClass('border-orange-500 border-2 translate-x-5 bg-orange-50');
            selectedModelId = model.ModelId;

            // Load specifications for selected model and update button state
            await loadSpecifications(model.ModelId);
            updateSpecButtonState();
        }
    });

    // Add hover effects
    div.on('mouseenter', () => {
        if (selectedModelId !== model.ModelId) {
            div.addClass('translate-x-2 bg-gray-50');
        }
    });

    div.on('mouseleave', () => {
        if (selectedModelId !== model.ModelId) {
            div.removeClass('translate-x-2 bg-gray-50');
        }
    });

    div.html(`
        <div class="flex items-start">
            ${imageHtml}
            <div class="flex-grow">
                <div class="flex justify-between items-start">
                    <div>
                        <h4 class="font-bold text-black">${model.PartNo}</h4>
                        <p class="text-sm text-black font-medium">${model.PartName}</p>
                        <p class="text-sm text-black">Material: ${model.Material}</p>
                        <p class="text-sm text-black">Production: ${new Date(model.ProductDate).toLocaleDateString()}</p>
                    </div>
                    <div class="flex space-x-2 ml-4">
                        <button onclick="cloneModel(${model.ModelId})" 
                                class="p-2 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-full transition-colors"
                                title="Clone Model">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                        </button>
                        <button onclick="editModel(${model.ModelId})" 
                                class="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-full transition-colors"
                                title="Edit Model">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                        </button>
                        <button onclick="deleteModelWithConfirm(${model.ModelId})" 
                                class="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-full transition-colors"
                                title="Delete Model">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `);
    return div;
}

async function loadModelForEdit(modelId) {
    try {
        console.log('🔍 Loading model for edit:', modelId);
        
        // Sync documents first
        console.log('📄 Starting document sync...');
        await ModelService.syncDocuments();
        console.log('📄 Document sync completed');
        
        // Then load the model
        const model = await ModelService.getModelById(modelId);
        console.log('📄 Model loaded:', {
            modelId: model.ModelId,
            documentsCount: model.Documents?.length || 0,
            documents: model.Documents,
            partNo: model.PartNo
        });

        const $form = $('#model-form');

        $form.find('[name="partNo"]').val(model.PartNo);
        $form.find('[name="partName"]').val(model.PartName);
        $form.find('[name="material"]').val(model.Material);
        $form.find('[name="productDate"]').val(model.ProductDate.split('T')[0]); // Format date for input

        $form.data('editing', modelId);

        // Load and display images
        const $imagePreview = $('#image-preview');
        $imagePreview.empty();

        if (model.Images && model.Images.length > 0) {
            console.log('📸 Loading images for model:', model.Images.length, 'images found');

            model.Images.forEach(image => {
                const $container = $('<div class="relative group"></div>');
                $container.data('imageId', image.ImageId);

                // Create image element
                const $img = $('<img>')
                    .addClass('w-full h-10 object-cover rounded-lg')
                    .attr('alt', image.FileName);

                // Set image source based on Base64Data
                if (image.Base64Data) {
                    console.log('📸 Loading base64 image:', image.FileName);
                    // Check if Base64Data already contains the data URL prefix
                    const base64Data = image.Base64Data.startsWith('data:')
                        ? image.Base64Data // Use as-is if it already has prefix
                        : `data:${image.ContentType};base64,${image.Base64Data}`; // Add prefix if needed
                    $img.attr('src', base64Data);
                }

                // Create delete button
                const $deleteButton = $(`
                    <button type="button"
                            class="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                `);

                // Add delete functionality
                $deleteButton.on('click', async () => {
                    try {
                        await ModelService.deleteModelImage(image.ImageId);
                        $container.remove();
                        showToast('Image deleted successfully');
                    } catch (error) {
                        showToast(error.message, 'error');
                    }
                });

                // Assemble the preview
                $container.append($img, $deleteButton);
                $imagePreview.append($container);
            });
        } else {
            console.log('📸 No images found for model');
        }

        // Load and display documents
        const $documentPreview = $('#document-preview');
        $documentPreview.empty();

        if (model.Documents && model.Documents.length > 0) {
            console.log('📄 Processing documents:', {
                count: model.Documents.length,
                documents: model.Documents.map(d => ({
                    fileName: d.FileName,
                    originalName: d.OriginalName,
                    fileSize: d.FileSize,
                    documentId: d.DocumentId,
                    modelId: d.ModelId
                }))
            });

            model.Documents.forEach(doc => {
                const $container = $('<div class="flex items-center justify-between p-2 bg-gray-50 rounded-lg"></div>');
                $container.html(`
                    <div class="flex items-center">
                        <svg class="w-6 h-6 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <div>
                            <p class="text-sm font-medium text-gray-900">${doc.OriginalName || doc.FileName}</p>
                            <p class="text-xs text-gray-500">${formatFileSize(doc.FileSize)}</p>
                        </div>
                    </div>
                    <div class="flex space-x-2">
                        <a href="http://localhost:8123/pdfs/${encodeURIComponent(doc.FileName)}" 
                           target="_blank"
                           class="text-blue-600 hover:text-blue-800 p-1 rounded-full hover:bg-blue-50 transition-colors"
                           title="View PDF">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                        </a>
                        <button type="button" onclick="deleteDocument(${doc.DocumentId}, '${doc.FileName}')"
                                class="text-red-600 hover:text-red-800 p-1 rounded-full hover:bg-red-50 transition-colors"
                                title="Delete PDF">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                    d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                `);

                $documentPreview.append($container);
            });
        } else {
            $documentPreview.append(`
                <div class="text-center py-0 text-gray-500">
                    <p class="font-medium">No documents attached</p>
                </div>
            `);
        }
    } catch (error) {
        console.error('❌ Error loading model:', error);
        showToast(error.message, 'error');
    }
}

async function deleteModelWithConfirm(modelId) {
    const result = await PopupUtil.showConfirm({
        title: 'Xác nhận xóa model?',
        message: 'Thao tác này sẽ không thể nào hoàn tác.',
        type: 'danger',
        confirmButtonText: 'Xóa',
        cancelButtonText: 'Hủy'
    });

    if (result) {
        try {
            await ModelService.deleteModel(modelId);
            if (selectedModelId === modelId) {
                selectedModelId = null;
                $('#specs-list').empty();
            }
            showToast('Đã xóa model thành công');
            loadModels();
        } catch (error) {
            showToast(error.message, 'error');
        }
    }
}

// Specification Functions
async function loadSpecifications(modelId) {
    try {
        const specs = await ModelSpecificationService.getSpecifications(modelId);
        const $specsList = $('#specs-list');
        $specsList.empty();

        if (specs.length === 0) {
            $specsList.html(`
                <div class="text-center py-4 text-gray-500">
                    <b>Không có thông số nào, hãy bấm (+) để thêm mới</b>
                </div>
            `);
            return;
        }

        specs.forEach(spec => {
            const specElement = createSpecListItem(spec);
            $specsList.append(specElement);
        });
    } catch (error) {
        console.error('Error loading specifications:', error);
        showToast(error.message, 'error');
    }
}

function createSpecListItem(spec) {
    const div = $('<div class="list-item border rounded-lg p-4 hover:bg-gray-50"></div>');
    div.html(`
        <div class="flex justify-between items-start">
            <div>
                <h4 class="font-bold text-black">${spec.SpecName}</h4>
                <p class="text-sm text-black">
                    Range: ${spec.MinValue} - ${spec.MaxValue} ${spec.Unit || ''}
                </p>
            </div>
            <div class="flex space-x-2">
                <button onclick="editSpec(${spec.SpecId})" 
                        class="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-full transition-colors"
                        title="Edit Specification">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                </button>
                <button onclick="deleteSpecWithConfirm(${spec.SpecId})" 
                        class="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-full transition-colors"
                        title="Delete Specification">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>
            </div>
        </div>
    `);
    return div;
}

async function deleteSpecWithConfirm(specId) {
    const result = await PopupUtil.showConfirm({
        title: 'Chắc chắn xóa thông số?',
        message: 'Thao tác này sẽ không thể hoàn tác.',
        type: 'danger',
        confirmButtonText: 'Xóa',
        cancelButtonText: 'Hủy'
    });

    if (result) {
        try {
            await ModelSpecificationService.deleteSpecification(specId);
            showToast('Đã xóa thông số thành công');
            const modelId = $('#spec-form [name="modelId"]').val();
            loadSpecifications(modelId);
        } catch (error) {
            showToast(error.message, 'error');
        }
    }
}

// Form Handling
async function handleModelSubmit(e) {
    e.preventDefault();

    try {
        const $form = $(e.target);
        const formData = new FormData(e.target);
        const modelData = {
            partNo: formData.get('partNo'),
            partName: formData.get('partName'),
            material: formData.get('material'),
            productDate: formData.get('productDate'),
            wo: '',
            machine: ''
        };

        if (!modelData.partNo || !modelData.partName || !modelData.material || !modelData.productDate) {
            throw new Error('Vui lòng điền đầy đủ thông tin');
        }

        const editingId = $form.data('editing');
        const cloningFromId = $form.data('cloning-from');
        const imageFiles = $('#image-upload')[0].files;

        let newModel;
        if (editingId) {
            modelData.modelId = parseInt(editingId);
            await ModelService.updateModel(modelData);

            // Handle document uploads
            const documentPreviews = $('#document-preview > div');
            if (documentPreviews.length > 0) {
                console.log('📄 Processing', documentPreviews.length, 'documents');
                for (const preview of documentPreviews) {
                    const $preview = $(preview);
                    const file = $preview.data('file');
                    if (file) {
                        try {
                            const formData = new FormData();
                            formData.append('file', file);
                            formData.append('modelId', modelData.modelId.toString());
                            
                            console.log('📄 Uploading document:', {
                                fileName: file.name,
                                modelId: modelData.modelId,
                                fileSize: file.size
                            });
                            
                            await ModelService.uploadModelDocument(formData);
                            console.log('📄 Document uploaded successfully:', file.name);
                        } catch (docError) {
                            console.error('❌ Error processing document:', docError);
                            showToast(`Error processing document ${file.name}: ${docError.message}`, 'error');
                        }
                    }
                }
            }

            // Handle image uploads for existing model
            if (imageFiles && imageFiles.length > 0) {
                console.log('📸 Processing', imageFiles.length, 'new images for update');
                for (const file of imageFiles) {
                    try {
                        // Convert each image to JPEG and upload
                        const imageData = await convertImageToJpeg(file);
                        console.log('📸 Uploading converted image:', {
                            fileName: imageData.FileName,
                            contentType: imageData.ContentType,
                            dataLength: imageData.Base64Data.length
                        });
                        await ModelService.uploadModelImage(modelData.modelId, imageData);
                    } catch (imgError) {
                        console.error('❌ Error processing image:', imgError);
                        showToast(`Error processing image ${file.name}: ${imgError.message}`, 'error');
                    }
                }
            }

            showToast('Model đã được cập nhật thành công');
        } else {
            try {
                // Create new model
                newModel = await ModelService.createModel(modelData);

                // Handle image uploads for new model
                if (imageFiles && imageFiles.length > 0) {
                    for (const file of imageFiles) {
                        // Convert image to JPEG and upload
                        const imageData = await convertImageToJpeg(file);
                        await ModelService.uploadModelImage(newModel.ModelId, imageData);
                    }
                }

                // If this was a clone operation, copy the specifications
                if (cloningFromId) {
                    console.log('🔄 Starting specification cloning process...');
                    const sourceSpecs = await ModelSpecificationService.getSpecifications(cloningFromId);
                    console.log(`📋 Found ${sourceSpecs.length} specifications to clone`);

                    for (const spec of sourceSpecs) {
                        await ModelSpecificationService.createSpecification({
                            modelId: newModel.ModelId,
                            specName: spec.SpecName,
                            minValue: spec.MinValue,
                            maxValue: spec.MaxValue,
                            unit: spec.Unit
                        });
                    }

                    closeModelModal();
                    selectedModelId = newModel.ModelId;
                    await loadModels();
                    await loadSpecifications(newModel.ModelId);
                    updateSpecButtonState();

                    showToast('Model đã được nhân bản với tất cả thông số');
                } else {
                    closeModelModal();
                    await loadModels();
                    showToast('Model đã được tạo thành công');
                }
            } catch (createError) {
                const errorMessage = createError.message || 'Unknown error occurred';
                if (errorMessage.toLowerCase().includes('already exists')) {
                    showToast('Model với Part No này đã tồn tại', 'error');
                } else {
                    showToast(errorMessage, 'error');
                }
                return;
            }
        }

        closeModelModal();
        await loadModels();
    } catch (error) {
        const errorMessage = error.message || 'Đã xảy ra lỗi không xác định';
        showToast(errorMessage, 'error');
    }
}

// Add this helper function for image conversion
async function convertImageToJpeg(file) {
    return new Promise((resolve, reject) => {
        if (!file || !file.type.startsWith('image/')) {
            reject(new Error('Invalid image file'));
            return;
        }

        const reader = new FileReader();
        reader.onload = function (e) {
            const img = new Image();
            img.onload = function () {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                canvas.width = img.width;
                canvas.height = img.height;

                // White background for PNGs
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);

                const jpegData = canvas.toDataURL('image/jpeg', 0.9);

                resolve({
                    Base64Data: jpegData,
                    FileName: file.name.replace(/\.[^/.]+$/, "") + ".jpg",
                    ContentType: 'image/jpeg'
                });
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function handleSpecSubmit(e) {
    e.preventDefault();

    try {
        const $form = $(e.target);
        const formData = new FormData(e.target);
        const specData = {
            modelId: selectedModelId,
            specName: formData.get('specName'),
            equipName: formData.get('equipName'),
            processName: formData.get('processName'),
            minValue: parseFloat(formData.get('minValue')),
            maxValue: parseFloat(formData.get('maxValue')),
            unit: formData.get('unit')
        };

        if (!specData.processName) {
            throw new Error('Please select a process');
        }

        if (specData.minValue >= specData.maxValue) {
            throw new Error('Minimum value must be less than maximum value');
        }

        const editingId = $form.data('editing');
        if (editingId) {
            specData.specId = parseInt(editingId);
            await ModelSpecificationService.updateSpecification(specData);
            showToast('Thông số đã được cập nhật thành công');
        } else {
            await ModelSpecificationService.createSpecification(specData);
            showToast('Thông số đã được tạo thành công');
        }

        closeSpecModal();
        loadSpecifications(specData.modelId);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// // Utility Functions
// function showToast(message, type = 'success') {
//     const $container = $('#toast-container');
//     const $toast = $('<div class="flex items-center p-4 mb-4 rounded-lg shadow-lg transition-all duration-500 transform translate-x-full"></div>');

//     const baseClasses = 'flex items-center p-4 mb-4 rounded-lg shadow-lg transition-all duration-500 transform translate-x-full';
//     const typeClasses = type === 'success'
//         ? 'text-green-800 bg-green-50'
//         : 'text-red-800 bg-red-50';

//     $toast.addClass(`${baseClasses} ${typeClasses}`);
//     $toast.html(`
//         <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
//             ${type === 'success' 
//                 ? '<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>'
//                 : '<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>'}
//         </svg>
//         <span class="text-sm font-semibold">${message}</span>
//     `);

//     $container.append($toast);
//     setTimeout(() => $toast.removeClass('translate-x-full'), 10);
//     setTimeout(() => {
//         $toast.addClass('translate-x-full');
//         setTimeout(() => $container.find('.toast').remove(), 500);
//     }, 3000);
// }

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function filterModels(searchTerm) {
    console.log('🔍 Filtering models with term:', searchTerm);

    // Remove any existing "no results" message first
    $('#models-list .no-results').remove();

    if (!searchTerm || searchTerm.trim() === '') {
        console.log('📝 Empty search term, showing all models');
        $('#models-list .list-item').show();
        return;
    }

    searchTerm = searchTerm.toLowerCase().trim();

    $('#models-list .list-item').each(function () {
        const $item = $(this);

        // Get all searchable text from the model item
        const partNo = $item.find('h4').text().toLowerCase();
        const partName = $item.find('p').eq(0).text().toLowerCase();
        const material = $item.find('p').eq(1).text().toLowerCase();
        const productDate = $item.find('p').eq(2).text().toLowerCase();

        // Combine all searchable fields
        const searchableText = `${partNo} ${partName} ${material} ${productDate}`;

        // Check if any field contains the search term
        const isVisible = searchableText.includes(searchTerm);
        console.log(`📄 Item ${partNo}: ${isVisible ? 'visible' : 'hidden'}`);

        $item.toggle(isVisible);
    });

    // Show "no results" message if no items are visible
    const visibleItems = $('#models-list .list-item:visible').length;
    console.log(`👀 Visible items: ${visibleItems}`);

    if (visibleItems === 0 && searchTerm.trim() !== '') {
        $('#models-list').append(`
            <div class="no-results text-center py-4 text-gray-500">
                <p class="font-medium">Không tìm thấy model nào với từ khóa "${searchTerm}"</p>
            </div>
        `);
    }
}

function filterSpecs(searchTerm) {
    console.log('🔍 Filtering specifications with term:', searchTerm);

    // Remove any existing "no results" message first
    $('#specs-list .no-results').remove();

    if (!searchTerm || searchTerm.trim() === '') {
        console.log('📝 Empty search term, showing all specs');
        $('#specs-list .list-item').show();
        return;
    }

    searchTerm = searchTerm.toLowerCase().trim();

    $('#specs-list .list-item').each(function () {
        const $item = $(this);

        // Get all searchable text from the spec item
        const specName = $item.find('h4').text().toLowerCase();
        const rangeText = $item.find('p').text().toLowerCase();

        // Combine all searchable fields
        const searchableText = `${specName} ${rangeText}`;

        // Check if any field contains the search term
        const isVisible = searchableText.includes(searchTerm);
        console.log(`📄 Spec ${specName}: ${isVisible ? 'visible' : 'hidden'}`);

        $item.toggle(isVisible);
    });

    // Show "no results" message if no items are visible
    const visibleItems = $('#specs-list .list-item:visible').length;
    console.log(`👀 Visible specs: ${visibleItems}`);

    if (visibleItems === 0 && searchTerm.trim() !== '') {
        $('#specs-list').append(`
            <div class="no-results text-center py-4 text-gray-500">
                <p class="font-medium">Không tìm thấy thông số nào với từ khóa "${searchTerm}"</p>
            </div>
        `);
    }
}

async function updateModelDropdown() {
    try {
        const models = await ModelService.getAllModels();
        const $select = $('#spec-form [name="modelId"]');
        $select.empty();
        $select.append('<option value="">Select a model</option>');

        models.forEach(model => {
            const $option = $('<option></option>');
            $option.val(model.ModelId);
            $option.text(`${model.ModelCode} - ${model.ModelName}`);
            $select.append($option);
        });
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// Image handling
function handleImageUpload(event) {
    const files = event.target.files;
    const $preview = $('#image-preview');
    const $imageUpload = $('#image-upload');

    // Check if there's already an image
    if ($preview.children().length > 0) {
        showToast('Only one image is allowed per model. Please remove the existing image first.', 'error');
        // Clear the file input
        $imageUpload.val('');
        return;
    }

    // Get the first file only
    const file = files[0];
    if (!file) return;

    // Check if file is an image
    if (!file.type.startsWith('image/')) {
        showToast('Please select only image files', 'error');
        $imageUpload.val('');
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        // Create an image element to draw to canvas
        const img = new Image();
        img.onload = function () {
            // Create canvas
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            // Set canvas size to match image
            canvas.width = img.width;
            canvas.height = img.height;

            // Draw image to canvas with white background (for PNGs)
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);

            // Convert to JPEG format
            const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.9);

            // Create preview container
            const $container = $('<div class="relative group"></div>');
            $container.html(`
                <img src="${jpegDataUrl}" class="w-full h-32 object-cover rounded-lg" />
                <button type="button" 
                        class="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            `);

            // Store the converted image data
            $container.data('imageData', jpegDataUrl);

            // Add remove button handler
            $container.find('button').on('click', () => {
                $container.remove();
                // Clear the file input so the same file can be selected again
                $imageUpload.val('');
            });

            // Clear existing previews and add new one
            $preview.empty().append($container);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function createImagePreviewElement(image) {
    const $container = $('<div class="relative group"></div>');
    $container.data('imageId', image.ImageId);

    const $img = $('<img>')
        .addClass('w-full h-32 object-cover rounded-lg')
        .attr('alt', image.FileName);

    // Set the image source using base64 data
    if (image.Base64Data) {
        const base64Data = image.Base64Data.startsWith('data:')
            ? image.Base64Data
            : `data:${image.ContentType};base64,${image.Base64Data}`;
        $img.attr('src', base64Data);
    } else {
        $img.attr('src', '../images/placeholder.png');
    }

    const $deleteButton = $(`
        <button type="button"
                class="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
        </button>
    `);

    // Add delete functionality
    $deleteButton.on('click', async () => {
        try {
            await ModelService.deleteModelImage(image.ImageId);
            $container.remove();
            // Enable the file input after deleting
            $('#image-upload').val('').prop('disabled', false);
            showToast('Image deleted successfully');
        } catch (error) {
            showToast(error.message, 'error');
        }
    });

    $container.append($img, $deleteButton);
    return $container;
}

// Add the missing editSpec function
async function editSpec(specId) {
    try {
        const spec = await ModelSpecificationService.getSpecificationById(specId);
        showSpecForm('edit', specId);

        // Wait for equipment options to load
        await loadEquipmentOptions();

        const $form = $('#spec-form');
        $form.find('[name="modelId"]').val(spec.ModelId);
        $form.find('[name="specName"]').val(spec.SpecName);

        // Set equipment selection
        const $equipSelect = $form.find('[name="equipName"]');
        if (spec.EquipName) {
            console.log('🔧 Setting equipment:', spec.EquipName);

            // If the equipment doesn't exist in the list, add it
            if (!$equipSelect.find(`option[value="${spec.EquipName}"]`).length) {
                console.log('🔧 Adding missing equipment option');
                $equipSelect.append(new Option(spec.EquipName, spec.EquipName));
            }

            // Set the value
            $equipSelect.val(spec.EquipName).trigger('change');
            console.log('🔧 Equipment set to:', $equipSelect.val());
        }

        // Set process selection
        const $processSelect = $form.find('[name="processName"]');
        if (spec.ProcessName) {
            console.log('🔧 Setting process:', spec.ProcessName);
            $processSelect.val(spec.ProcessName);
        }

        $form.find('[name="minValue"]').val(spec.MinValue);
        $form.find('[name="maxValue"]').val(spec.MaxValue);
        $form.find('[name="unit"]').val(spec.Unit || '');

        $form.data('editing', specId);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// Add the missing editModel function
async function editModel(modelId) {
    try {
        showModelForm('edit', modelId);
        await loadModelForEdit(modelId);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// Update ESC key handler
$(document).on('keydown', function (e) {
    if (e.key === 'Escape') {
        $('#model-modal, #spec-modal').addClass('hidden');
        // Refresh specifications list if a model is selected
        if (selectedModelId) {
            loadSpecifications(selectedModelId);
        }
    }
});

// Add this function to handle spec button state
function updateSpecButtonState() {
    const $specButton = $('#new-spec-btn');
    const $specsList = $('#specs-list');

    if (!selectedModelId) {
        $specButton.prop('disabled', true)
            .addClass('opacity-50 cursor-not-allowed')
            .attr('title', 'Vui lòng nhấn chọn một model bất kì trước');

        $specsList.html(`
            <div class="text-center py-8 text-gray-500">
                <svg class="w-6 h-6 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                </svg>
                <p class="font-medium">Vui lòng nhấn chọn một model bất kì</p>
            </div>
        `);
    } else {
        $specButton.prop('disabled', false)
            .removeClass('opacity-50 cursor-not-allowed')
            .attr('title', 'Add new specification');
    }
}

// Update the cloneModel function
async function cloneModel(modelId) {
    try {
        const result = await PopupUtil.showConfirm({
            title: 'Nhân bản Model',
            message: 'Hãy sửa thông tin của model này trước khi nhân bản.',
            type: 'info',
            confirmButtonText: 'Tiếp tục',
            cancelButtonText: 'Hủy'
        });

        if (result) {
            // Get the source model data
            const sourceModel = await ModelService.getModelById(modelId);
            console.log('📋 Source model data:', sourceModel); // Debug log

            // Show the model form in clone mode
            showModelForm('clone');

            // Pre-fill the form with the model data
            const $form = $('#model-form');
            $form.find('[name="partNo"]').val(sourceModel.PartNo + ' (Copy)');
            $form.find('[name="partName"]').val(sourceModel.PartName + ' (Copy)');
            $form.find('[name="material"]').val(sourceModel.Material);
            $form.find('[name="productDate"]').val(new Date().toISOString().split('T')[0]); // Today's date

            // Store the source model ID for cloning specs later
            $form.data('cloning-from', modelId);

            // Update modal title to indicate cloning
            $('#model-form-title').text('Nhân bản Model: ' + sourceModel.PartNo);

            // Copy images if any
            const $imagePreview = $('#image-preview');
            $imagePreview.empty();

            if (sourceModel.Images && sourceModel.Images.length > 0) {
                sourceModel.Images.forEach(image => {
                    const imgContainer = createImagePreviewElement(image);
                    $imagePreview.append(imgContainer);
                });
            }

            const specsCount = sourceModel.Specifications?.length || 0;
            console.log('📊 Number of specifications to clone:', specsCount); // Debug log

            // Add a note about specifications
            $form.find('button[type="submit"]').before(`
                <div class="text-sm text-gray-600 bg-gray-100 p-3 rounded-lg">
                    <p class="font-medium">Lưu ý:</p>
                    <p>Tất cả các thông số của model gốc sẽ được sao chép tự động sau khi lưu.</p>
                    <p class="mt-1 text-xs">Tổng số thông số sẽ đưc sao chép: ${specsCount}</p>
                </div>
            `);
        }
    } catch (error) {
        console.error('❌ Error in cloneModel:', error);
        showToast(error.message, 'error');
    }
}

// Add this function to load equipment options
async function loadEquipmentOptions() {
    try {
        const equipments = await ModelSpecificationService.getAllEquipments();
        const $select = $('#spec-form [name="equipName"]');
        $select.empty();
        $select.append('<option value="">Select Equipment</option>');

        equipments.forEach(equip => {
            const $option = $('<option></option>')
                .val(equip.EquipName)
                .text(equip.EquipName)
                .data('equip-id', equip.EquipId);
            $select.append($option);
        });
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function handleEquipSubmit(e) {
    e.preventDefault();

    try {
        const $form = $(e.target);
        const equipName = $form.find('[name="equipName"]').val().trim();

        if (!equipName) {
            throw new Error('Equipment name is required');
        }

        const equipData = {
            EquipName: equipName  // Change to uppercase 'E' to match C# model
        };

        console.log('📤 Sending equipment data:', equipData);

        await ModelSpecificationService.createEquipment(equipData);
        showToast('Equipment added successfully');
        closeEquipModal();
        await loadEquipmentOptions();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function deleteEquipment(equipId) {
    try {
        const $select = $('#spec-form [name="equipName"]');
        const selectedEquip = $select.find('option:selected');
        const equipName = selectedEquip.text();

        const result = await PopupUtil.showConfirm({
            title: 'Xóa thiết bị',
            message: `Xóa "${equipName}"? Điều này sẽ xóa thiết bị khỏi tất cả các thông số sử dụng nó.`,
            type: 'danger',
            confirmButtonText: 'Xóa',
            cancelButtonText: 'Hủy'
        });

        if (result) {
            const deleteResult = await ModelSpecificationService.deleteEquipment(equipId);
            showToast('Equipment deleted successfully');

            // Refresh equipment dropdown
            await loadEquipmentOptions();

            // If we have a selected model, refresh its specifications
            if (selectedModelId) {
                await loadSpecifications(selectedModelId);
            }
        }
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// Add these functions for equipment handling
function showEquipModal() {
    const $modal = $('#equip-modal');
    const $form = $('#equip-form');
    $form[0].reset();
    $modal.removeClass('hidden');
}

function closeEquipModal() {
    $('#equip-modal').addClass('hidden');
}

// Handle document upload
function handleDocumentUpload(event) {
    const files = event.target.files;
    const $preview = $('#document-preview');

    Array.from(files).forEach(file => {
        // Check if file is a PDF
        if (file.type !== 'application/pdf') {
            showToast('Please select only PDF files', 'error');
            return;
        }

        // Create preview element
        const $container = $('<div class="flex items-center justify-between p-2 bg-gray-50 rounded-lg"></div>');
        $container.html(`
            <div class="flex items-center">
                <svg class="w-6 h-6 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <div>
                    <p class="text-sm font-medium text-gray-900">${file.name}</p>
                    <p class="text-xs text-gray-500">${formatFileSize(file.size)}</p>
                </div>
            </div>
            <button type="button" 
                    class="text-red-600 hover:text-red-800 p-1 rounded-full hover:bg-red-50 transition-colors">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        `);

        // Add remove functionality
        $container.find('button').on('click', () => $container.remove());
        
        // Store the file data
        $container.data('file', file);
        
        $preview.append($container);
    });
}

// Add this helper function to format file sizes
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Add document management functions
async function downloadDocument(documentId) {
    try {
        await ModelService.downloadModelDocument(documentId);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function deleteDocument(documentId, fileName) {
    try {
        const result = await PopupUtil.showConfirm({
            title: 'Delete Document',
            message: 'Are you sure you want to delete this document?',
            type: 'danger',
            confirmButtonText: 'Delete',
            cancelButtonText: 'Cancel'
        });

        if (result) {
            await ModelService.deleteModelDocument({
                documentId: documentId,
                fileName: fileName
            });
            showToast('Document deleted successfully');
            const modelId = $('#model-form').data('editing');
            if (modelId) {
                await loadModelForEdit(modelId);
            }
        }
    } catch (error) {
        showToast(error.message, 'error');
    }
}
