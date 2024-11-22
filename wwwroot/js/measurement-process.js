class MeasurementProcess {
    constructor() {
        this.initialize();
        // Keep track of active listener
        this.currentListener = null;
        this.measurementHistory = [];
        this.lastMeasurementTime = 0;
        this.measurementDebounceTime = 1000; // 1 second debounce
        this.measurementListenerCount = 0; // Add counter for debugging
        this.isListenerActive = false; // Add new flag to track listener state
    }

    // Add new method to handle listener management
    setupEventEmitter() {
        try {
            // Increase max listeners limit if needed
            if (window.electronAPI.setMaxListeners) {
                window.electronAPI.setMaxListeners(20);
            }
        } catch (error) {
            console.warn('Unable to set max listeners:', error);
        }
    }

    async initHardware() {
        const selectedPort = localStorage.getItem('selected-serial-port');
        
        window.electronAPI.receive('receiver-status-received', (result) => {
            $('#measurement-start-text').text('Thiết bị đã sẵn sàng, đang bắt đầu đo...');
            this.autoStartMeasuring();
        });

        window.electronAPI.receive('command-error', (errorMessage) => {
            $('#measurement-start-text').text('Không thể kết nối tới thiết bị đo, vui lòng kiểm tra trong menu Phần cứng');
            console.error('Command error:', errorMessage);
        });

        window.electronAPI.send('connect-to-serial-port', selectedPort);
        await new Promise(resolve => setTimeout(resolve, 1500));
        window.electronAPI.send('check-receiver-info');
    }

    autoStartMeasuring() {
        if (!this.currentModelId) {
            const modelSelect = document.getElementById('modelSelect');
            if (!modelSelect || !modelSelect.value) {
                showToast('Please select a model first', 'error');
                return;
            }
            this.initializeForModel(modelSelect.value);
            return;
        }

        if (!this.modelSpecs.length) {
            showToast('Vui lòng thêm thông số cho model này trước', 'error');
            return;
        }

        // Make sure start button is hidden
        document.getElementById('start-container').classList.add('hidden');
        document.getElementById('measurement-prompt').classList.remove('hidden');
        
        // Reset measurement state
        this.currentEquipIndex = 0;
        this.currentSpecIndexInGroup = 0;
        this.measurements.clear();
        
        // Start the measurement process
        this.startCountdown();
    }

    async initialize() {
        try {
            this.setupEventEmitter();
            await this.initHardware();
            this.currentSpecIndex = 0;
            this.measurements = new Map();
            this.countdownInterval = null;
            this.modelSpecs = [];
            this.currentModelId = null;
            this.groupedSpecs = [];
            this.currentEquipIndex = 0;
            this.currentSpecIndexInGroup = 0;
            this.previousSpec = null;

            // Get initial model if already selected
            const modelSelect = document.getElementById('modelSelect');
            if (modelSelect && modelSelect.value) {
                await this.initializeForModel(modelSelect.value);
            }

            this.setupEventListeners();
        } catch (error) {
            console.error('Error in initialize:', error);
            showToast('Failed to initialize', 'error');
        }
    }

    async initializeForModel(modelId, modelCode) {
        try {
            if (!modelId) {
                console.warn('No model ID provided');
                return;
            }

            this.currentModelId = modelId;
            this.currentModelCode = modelCode;

            // Get specifications and group them
            this.modelSpecs = await ModelSpecificationService.getSpecifications(modelId);
            this.groupedSpecs = this.groupSpecsByEquipment(this.modelSpecs);
            
            // Initialize progress tracking
            this.initializeProgressTracking();
            
            // Load model images
            await this.loadModelImages(modelId);

        } catch (error) {
            console.error('Error loading model data:', error);
            showToast('Failed to load model data: ' + error.message, 'error');
        }
    }

    async loadModelImages(modelId) {
        try {
            const model = await ModelService.getModelById(modelId);
            const container = document.getElementById('model-images');
            container.innerHTML = ''; // Clear existing images

            if (model.Images && model.Images.length > 0) {
                // Create and append all images at once
                const imagesHTML = model.Images.map((img, index) => {
                    if (!img.Base64Data) {
                        console.warn(`⚠️ No base64 data for image ${index + 1}`);
                        return '';
                    }

                    // Remove any existing data URL prefix before adding our own
                    const base64Data = img.Base64Data.replace(/^data:.*?;base64,/, '');
                    const imgSrc = `data:${img.ContentType || 'image/jpeg'};base64,${base64Data}`;

                    return `
                        <div class="relative aspect-video mb-4">
                            <img src="${imgSrc}" 
                                alt="${img.FileName || `Model View ${index + 1}`}" 
                                class="w-full h-full object-contain rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer"
                                onerror="this.src='../images/placeholder.png'; console.error('❌ Failed to load image ${index + 1}')"
                                onclick="window.measurementForm.showImagePreview(this.src)"
                            >
                        </div>
                    `;
                }).join('');

                container.innerHTML = imagesHTML || `
                    <div class="text-center py-4 text-gray-500">
                        <p class="font-medium">No valid images found</p>
                    </div>
                `;

                // Setup preview modal handlers
                this.setupImagePreviewHandlers();
            } else {
                container.innerHTML = `
                    <div class="text-center py-4 text-gray-500">
                        <p class="font-medium">No images available</p>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error loading model images:', error);
            const container = document.getElementById('model-images');
            container.innerHTML = `
                <div class="text-center py-4 text-red-500">
                    <p class="font-medium">Error loading images</p>
                </div>
            `;
        }
    }

    initializeProgressTracking() {
        const tbody = document.getElementById('measurement-progress');
        if (!tbody) {
            console.warn('Progress tracking table not found');
            return;
        }

        tbody.innerHTML = ''; // Clear existing rows

        if (!this.modelSpecs || !Array.isArray(this.modelSpecs)) {
            console.warn('No model specifications available');
            return;
        }

        this.modelSpecs.forEach(spec => {
            const row = document.createElement('tr');
            row.id = `spec-row-${spec.SpecId}`;
            row.className = 'transition-all duration-150';
            
            row.innerHTML = `
                <td class="px-3 py-2 whitespace-nowrap w-[80px] max-w-[80px] overflow-hidden text-ellipsis">
                    <span class="font-medium">${spec.SpecName}</span>
                </td>
                <td class="px-3 py-2 whitespace-nowrap">
                    <span class="text-gray-600">${spec.EquipName}</span>
                </td>
                <td class="px-3 py-2 whitespace-nowrap">
                    <span class="text-sm">${spec.MinValue} - ${spec.MaxValue} ${spec.Unit}</span>
                </td>
                <td class="px-3 py-2 whitespace-nowrap" id="spec-value-${spec.SpecId}">
                    <span class="text-gray-400">Đang chờ...</span>
                </td>
            `;
            
            tbody.appendChild(row);
        });
    }

    // Add this new method to group specs by equipment
    groupSpecsByEquipment(specs) {
        // Group specs by EquipName
        const groups = specs.reduce((acc, spec) => {
            const equipName = spec.EquipName || 'Other';
            if (!acc[equipName]) {
                acc[equipName] = [];
            }
            acc[equipName].push(spec);
            return acc;
        }, {});

        // Convert to array format for easier iteration
        return Object.entries(groups).map(([equipName, specs]) => ({
            equipName,
            specs
        }));
    }

    setupEventListeners() {
        console.log('Setting up event listeners');
        const remeasureButton = document.getElementById('remeasure-prev-spec');
        if (remeasureButton) {
            remeasureButton.addEventListener('click', () => this.remeasurePreviousSpec());
        }

        const confirmButton = document.getElementById('confirm-measurement');
        if (confirmButton) {
            confirmButton.addEventListener('click', this.confirmMeasurement.bind(this));
        }

        const continueButton = document.getElementById('continue-measuring');
        if (continueButton) {
            continueButton.addEventListener('click', () => this.showMoldNumberModal('continue'));
        }

        const cancelButton = document.getElementById('cancel-measuring');
        if (cancelButton) {
            cancelButton.addEventListener('click', () => this.showMoldNumberModal('exit'));
        }

        const startOverButton = document.getElementById('start-over');
        if (startOverButton) {
            startOverButton.addEventListener('click', this.startOver.bind(this));
        }

        // Add keyboard event listener for continue dialog
        document.addEventListener('keydown', this.handleKeyPress.bind(this));

        // Modify space key handler to be more reliable
        document.removeEventListener('keydown', this.handleSpaceKey); // Remove any existing handler
        this.handleSpaceKey = (event) => {
            if (event.code === 'Space' && !event.repeat) {
                event.preventDefault();
                
                // Only handle space if we're in measurement mode (not in dialogs)
                const continueDialog = document.getElementById('continue-dialog');
                const moldNumberModal = document.getElementById('mold-number-modal');
                
                if (!continueDialog.classList.contains('hidden') || 
                    !moldNumberModal.classList.contains('hidden')) {
                    return;
                }

                // Check if we have history to go back
                if (this.measurementHistory.length > 0) {
                    console.log('Space pressed - Going back one measurement');
                    this.remeasurePreviousSpec();
                }
            }
        };
        document.addEventListener('keydown', this.handleSpaceKey);
    }

    handleKeyPress(event) {
        // Only handle keystrokes when continue dialog is visible
        const continueDialog = document.getElementById('continue-dialog');
        const moldNumberModal = document.getElementById('mold-number-modal');
        
        if (continueDialog.classList.contains('hidden')) return;
        if (!moldNumberModal.classList.contains('hidden')) return; // Don't handle if mold modal is open

        switch(event.key) {
            case 'Enter':
                event.preventDefault();
                this.showMoldNumberModal('continue');
                break;
            case 'Escape':
                event.preventDefault();
                this.showMoldNumberModal('exit');
                break;
            case ' ': // Space
                event.preventDefault(); // Prevent page scroll
                this.startOver();
                break;
        }
    }

    showMoldNumberModal(action) {
        const modal = document.getElementById('mold-number-modal');
        const input = document.getElementById('modal-mold-number');
        const confirmBtn = document.getElementById('modal-mold-confirm');
        const cancelBtn = document.getElementById('modal-mold-cancel');

        // Show modal
        modal.classList.remove('hidden');
        input.value = '';
        input.focus();

        // Remove any existing listeners
        confirmBtn.removeEventListener('click', confirmBtn.clickHandler);
        cancelBtn.removeEventListener('click', cancelBtn.clickHandler);
        input.removeEventListener('keydown', input.keyHandler);

        // Setup handlers
        const handleConfirm = async () => {
            const moldNumber = input.value.trim();
            if (!moldNumber) {
                document.getElementById('modal-mold-number-error').classList.remove('hidden');
                return;
            }
            
            // Hide modal
            modal.classList.add('hidden');
            
            // Trigger appropriate action with the mold number
            if (action === 'continue') {
                await this.continueNewProduct();
            } else if (action === 'exit') {
                await this.cancelProcess();
            }
        };

        const handleCancel = () => {
            modal.classList.add('hidden');
        };

        // Add click handlers
        confirmBtn.clickHandler = handleConfirm;
        cancelBtn.clickHandler = handleCancel;
        confirmBtn.addEventListener('click', confirmBtn.clickHandler);
        cancelBtn.addEventListener('click', cancelBtn.clickHandler);

        // Add keyboard handler for the input
        input.keyHandler = (e) => {
            if (e.key === 'Enter') {
                handleConfirm();
            } else if (e.key === 'Escape') {
                handleCancel();
            }
        };
        input.addEventListener('keydown', input.keyHandler);
    }

    startCountdown() {
        // Check if we have valid groups and specs
        if (!this.groupedSpecs || !this.groupedSpecs.length || 
            this.currentEquipIndex >= this.groupedSpecs.length) {
            console.error('Invalid group index or no groups available');
            return;
        }

        const currentGroup = this.groupedSpecs[this.currentEquipIndex];
        if (!currentGroup || !currentGroup.specs || !currentGroup.specs.length || 
            this.currentSpecIndexInGroup >= currentGroup.specs.length) {
            console.error('Invalid spec index or no specs available in current group');
            return;
        }

        const currentSpec = currentGroup.specs[this.currentSpecIndexInGroup];

        // Remove highlight from all rows first
        document.querySelectorAll('#measurement-progress tr').forEach(row => {
            row.removeAttribute('style');
            row.classList.remove('bg-blue-50', 'border-l-4', 'border-blue-500');
        });

        // Highlight only the current spec row using inline styles for !important
        const currentRow = document.getElementById(`spec-row-${currentSpec.SpecId}`);
        if (currentRow) {
            currentRow.style.cssText = `
                background-color: rgb(239 246 255) !important;
                border-left: 4px solid rgb(59 130 246) !important;
            `;
            // Ensure the row is visible by scrolling to it
            currentRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        // Update equipment name display
        document.getElementById('equipment-name').textContent = currentGroup.equipName;
        document.getElementById('equipment-message').classList.remove('hidden');
        document.getElementById('current-spec-name').textContent = currentSpec.SpecName;
        document.getElementById('measurement-value').textContent = '--';

        document.getElementById('countdown').textContent = 'Waiting...';
        document.getElementById('countdown-text').textContent = 'Bấm nút trên thước để gửi số đo...';
        // document.getElementById('measurement-buttons').classList.add('hidden');

        // Setup measurement data listener
        this.setupMeasurementListener();

        // Update remeasure button visibility
        const remeasureButton = document.getElementById('remeasure-prev-spec');
        if (remeasureButton) {
            // Show button only if we have a previous measurement
            if (this.measurements.size > 0) {
                remeasureButton.classList.remove('hidden');
            } else {
                remeasureButton.classList.add('hidden');
            }
        }
    }

    setupMeasurementListener() {
        // If a listener is already active, don't add another one
        if (this.isListenerActive) {
            console.log('Measurement listener already active, skipping setup');
            return;
        }

        // First, ensure we remove any existing listener
        this.removeMeasurementListener();

        // Create new listener
        this.currentListener = (data) => {
            if (!this.isListenerActive) {
                console.log('Listener received data but is marked as inactive, ignoring');
                return;
            }

            if (!data || (Array.isArray(data) && !data.length)) {
                console.error('❌ Invalid measurement data received');
                return;
            }

            const measurementValue = Array.isArray(data) ? parseFloat(data[0]) : parseFloat(data);
            
            if (isNaN(measurementValue)) {
                console.error('❌ Invalid measurement value:', data);
                return;
            }
            
            this.getMeasurement(measurementValue);

            const unmeasuredSpecs = this.getUnmeasuredSpecs();
            if (unmeasuredSpecs.length > 0) {
                const nextSpec = this.findNextUnmeasuredSpec();
                if (nextSpec) {
                    setTimeout(() => {
                        this.moveToNextUnmeasuredSpec(nextSpec);
                    }, 1000);
                }
            } else {
                this.showContinueDialog();
                this.removeMeasurementListener();
            }
        };

        // Add the new listener
        window.electronAPI.receive('measurement-data-received', this.currentListener);
        this.isListenerActive = true;
        this.measurementListenerCount = 1; // Reset to 1 since we should only have one
        console.log('Measurement listener setup complete');
    }

    removeMeasurementListener() {
        if (this.currentListener) {
            try {
                if (window.electronAPI.removeListener) {
                    window.electronAPI.removeListener('measurement-data-received', this.currentListener);
                }
                if (window.electronAPI.off) {
                    window.electronAPI.off('measurement-data-received', this.currentListener);
                }
                this.isListenerActive = false;
                this.measurementListenerCount = 0;
                this.currentListener = null;
                console.log('Measurement listener removed');
            } catch (error) {
                console.warn('Error removing listener:', error);
            }
        }
    }

    // Add new helper methods
    getUnmeasuredSpecs() {
        const allSpecs = this.modelSpecs.map(spec => spec.SpecId);
        const measuredSpecs = Array.from(this.measurements.keys());
        return allSpecs.filter(specId => !measuredSpecs.includes(specId));
    }

    findNextUnmeasuredSpec() {
        const unmeasuredSpecs = this.getUnmeasuredSpecs();
        if (!unmeasuredSpecs.length) return null;

        // Find the spec object for the first unmeasured spec ID
        for (let groupIndex = 0; groupIndex < this.groupedSpecs.length; groupIndex++) {
            const group = this.groupedSpecs[groupIndex];
            for (let specIndex = 0; specIndex < group.specs.length; specIndex++) {
                const spec = group.specs[specIndex];
                if (unmeasuredSpecs.includes(spec.SpecId)) {
                    return {
                        groupIndex,
                        specIndex,
                        spec
                    };
                }
            }
        }
        return null;
    }

    moveToNextUnmeasuredSpec(nextSpec) {
        this.removeMeasurementListener();
        this.currentEquipIndex = nextSpec.groupIndex;
        this.currentSpecIndexInGroup = nextSpec.specIndex;
        this.startCountdown();
    }

    // Modify getMeasurement to include debouncing
    getMeasurement(data) {
        const now = Date.now();
        if (now - this.lastMeasurementTime < this.measurementDebounceTime) {
            console.log('Measurement debounced - too soon after last measurement');
            return;
        }
        this.lastMeasurementTime = now;

        if (!this.groupedSpecs || !this.groupedSpecs[this.currentEquipIndex]) {
            console.error('❌ Invalid group state in getMeasurement');
            return;
        }

        const currentGroup = this.groupedSpecs[this.currentEquipIndex];
        if (!currentGroup.specs || !currentGroup.specs[this.currentSpecIndexInGroup]) {
            console.error('❌ Invalid spec state in getMeasurement');
            return;
        }

        const currentSpec = currentGroup.specs[this.currentSpecIndexInGroup];
        
        // Store measurement history before adding new measurement
        this.measurementHistory.push({
            groupIndex: this.currentEquipIndex,
            specIndex: this.currentSpecIndexInGroup,
            spec: currentSpec,
            value: data,
            timestamp: now
        });
        
        console.log('Added to history. Current history length:', this.measurementHistory.length);
        
        // Check if this spec has already been measured
        if (this.measurements.has(currentSpec.SpecId)) {
            // console.log('⚠️ Spec already measured, skipping:', currentSpec.SpecName);
            return;
        }
        
        // console.log('📏 Processing measurement:', {
        //     specId: currentSpec.SpecId,
        //     specName: currentSpec.SpecName,
        //     value: data,
        //     equipName: currentGroup.equipName,
        //     currentEquipIndex: this.currentEquipIndex,
        //     currentSpecIndexInGroup: this.currentSpecIndexInGroup
        // });

        // Update UI
        document.getElementById('measurement-value').textContent = `${data} ${currentSpec.Unit}`;
        
        // Store measurement
        this.measurements.set(currentSpec.SpecId, data);
        
        // Log current measurements state
        // console.log('📊 Updated measurements:', {
            // size: this.measurements.size,
            // expected: this.getTotalExpectedMeasurements(),
            // remaining: this.getUnmeasuredSpecs().length,
            // measurements: Array.from(this.measurements.entries()).map(([specId, value]) => {
            //     const spec = this.findSpecById(specId);
            //     return {
            //         specId,
            //         specName: spec?.SpecName,
            //         value,
            //         equipName: spec?.EquipName
            //     };
            // })
        // });

        // Update progress tracking
        const valueCell = document.getElementById(`spec-value-${currentSpec.SpecId}`);
        const row = document.getElementById(`spec-row-${currentSpec.SpecId}`);
        
        if (valueCell && row) {
            const isWithinRange = data >= currentSpec.MinValue && data <= currentSpec.MaxValue;
            
            valueCell.innerHTML = `
                <span class="${isWithinRange ? 'text-green-600' : 'text-red-600'} font-medium">
                    ${data} ${currentSpec.Unit}
                </span>
            `;
            
            // Remove all styles completely
            row.removeAttribute('style');
            row.classList.remove('bg-blue-50', 'border-l-4', 'border-blue-500');
        }

        // Store current spec as previous before processing new measurement
        this.previousSpec = {
            groupIndex: this.currentEquipIndex,
            specIndex: this.currentSpecIndexInGroup,
            spec: currentSpec
        };
    }

    // Helper method to find spec by ID
    findSpecById(specId) {
        for (const group of this.groupedSpecs) {
            const spec = group.specs.find(s => s.SpecId === specId);
            if (spec) return spec;
        }
        return null;
    }

    // Helper method to get total expected measurements
    getTotalExpectedMeasurements() {
        return this.groupedSpecs.reduce((total, group) => total + group.specs.length, 0);
    }

    simulateMeasurement() {
        const spec = this.modelSpecs[this.currentSpecIndex];

        // 20% chance to generate value outside the valid range
        const outsideRange = Math.random() < 0.2;

        let measurement;
        if (outsideRange) {
            // Generate value that's 1-20% outside the range (either above or below)
            const deviation = (spec.MaxValue - spec.MinValue) * (Math.random() * 0.2 + 0.01);
            measurement = Math.random() < 0.5
                ? (spec.MinValue - deviation).toFixed(2) // Below min
                : (spec.MaxValue + deviation).toFixed(2); // Above max
        } else {
            // Generate value within valid range
            measurement = (Math.random() * (spec.MaxValue - spec.MinValue) + spec.MinValue).toFixed(2);
        }

        document.getElementById('measurement-value').textContent = `${measurement} ${spec.Unit}`;
        this.measurements.set(spec.SpecId, parseFloat(measurement));
    }

    confirmMeasurement() {
        this.showContinueDialog();
    }

    showContinueDialog() {
        // console.log('📊 Showing measurement summary:', {
            // totalMeasurements: this.measurements.size,
            // expectedMeasurements: this.getTotalExpectedMeasurements(),
            // measurements: Array.from(this.measurements.entries()).map(([specId, value]) => {
            //     const spec = this.findSpecById(specId);
            //     return {
            //         specId,
            //         specName: spec?.SpecName,
            //         value,
            //         equipName: spec?.EquipName
            //     };
            // })
        // });

        const dialog = document.getElementById('continue-dialog');
        const summary = document.getElementById('measurements-summary');

        // Group measurements by equipment for better organization
        const measurementsByEquip = {};
        
        // First, organize specs by their equipment
        this.modelSpecs.forEach(spec => {
            const equipName = spec.EquipName || 'Other';
            if (!measurementsByEquip[equipName]) {
                measurementsByEquip[equipName] = [];
            }
            
            const value = this.measurements.get(spec.SpecId);
            if (value !== undefined) {
                measurementsByEquip[equipName].push({
                    specName: spec.SpecName,
                    value: value,
                    unit: spec.Unit,
                    minValue: spec.MinValue,
                    maxValue: spec.MaxValue
                });
            }
        });

        // Build the HTML for the summary
        let summaryHTML = '';
        
        // Add each equipment group
        Object.entries(measurementsByEquip).forEach(([equipName, measurements]) => {
            summaryHTML += `
                <div class="mb-3">
                    <div class="font-semibold text-gray-700 mb-2">${equipName}:</div>
                    ${measurements.map(m => {
                        const isWithinRange = m.value >= m.minValue && m.value <= m.maxValue;
                        const valueClass = isWithinRange ? 'text-green-600' : 'text-red-600';
                        
                        return `
                            <div class="flex justify-between py-1 border-b">
                                <span class="text-gray-700">${m.specName}</span>
                                <span class="${valueClass} font-medium">
                                    ${m.value.toFixed(3)} ${m.unit}
                                </span>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        });

        // Add total measurements count
        const totalMeasurements = this.measurements.size;
        summaryHTML = `
            <div class="text-right text-sm text-gray-500 mb-2">
                Total measurements: ${totalMeasurements}
            </div>
        ` + summaryHTML;

        // Set the summary HTML
        summary.innerHTML = summaryHTML;

        // Show the dialog
        dialog.classList.remove('hidden');
    }

    // Modify existing methods to use modal mold number
    validateMoldNumber() {
        const moldNumberInput = document.getElementById('modal-mold-number');
        const errorText = document.getElementById('modal-mold-number-error');
        const value = moldNumberInput.value.trim();

        if (!value) {
            moldNumberInput.classList.add('border-red-500');
            errorText.classList.remove('hidden');
            return false;
        }

        moldNumberInput.classList.remove('border-red-500');
        errorText.classList.add('hidden');
        return true;
    }

    async cancelProcess() {
        try {
            if (this.measurements.size > 0) {
                const moldNumberInput = document.getElementById('modal-mold-number');
                if (!moldNumberInput) {
                    console.warn('Mold number input not found');
                    return;
                }

                const moldNumber = moldNumberInput.value.trim();
                if (!moldNumber) {
                    showToast('Please enter a mold number', 'error');
                    return;
                }

                // Create new product
                const productData = {
                    modelId: this.currentModelId,
                    measurementDate: new Date().toISOString(),
                    moldNumber: moldNumber
                };

                console.log('📦 Creating product with data:', productData);
                const product = await ProductService.createProduct(productData);
                console.log('✅ Product created:', product);

                // Save all measurements
                const measurementPromises = Array.from(this.measurements.entries()).map(([specId, value]) => {
                    const measurementData = {
                        productId: product.ProductId,
                        specId: parseInt(specId),
                        value: value,
                        measurementDate: new Date().toISOString()
                    };
                    return ProductSpecificationService.addMeasurement(measurementData);
                });

                await Promise.all(measurementPromises);
                showToast('Measurements saved successfully');

                // Refresh the table if needed
                if (this.currentModelId && window.loadProductMeasurements) {
                    await loadProductMeasurements(this.currentModelId);
                }
            }

            // Hide modals - thêm kiểm tra null
            ['continue-dialog', 'mold-number-modal'].forEach(id => {
                const element = document.getElementById(id);
                if (element) {
                    element.classList.add('hidden');
                }
            });

            this.cleanup();
            if (typeof closeModal === 'function') {
                closeModal();
            }

        } catch (error) {
            console.error('Error saving final measurements:', error);
            showToast(error.message, 'error');
        }
    }

    async continueNewProduct() {
        try {
            if (!this.validateMoldNumber()) {
                return;
            }

            const moldNumber = document.getElementById('modal-mold-number').value.trim();
            if (!moldNumber) {
                showToast('Please enter a mold number', 'error');
                return;
            }

            // Create new product
            const productData = {
                modelId: this.currentModelId,
                measurementDate: new Date().toISOString(),
                moldNumber: moldNumber
            };

            console.log('📦 Creating product with data:', productData);
            const product = await ProductService.createProduct(productData);

            // Save all measurements
            const measurementPromises = Array.from(this.measurements.entries()).map(([specId, value]) => {
                const measurementData = {
                    productId: product.ProductId,
                    specId: parseInt(specId),
                    value: value,
                    measurementDate: new Date().toISOString()
                };
                return ProductSpecificationService.addMeasurement(measurementData);
            });

            await Promise.all(measurementPromises);

            // Hide dialogs
            document.getElementById('continue-dialog').classList.add('hidden');
            document.getElementById('mold-number-modal').classList.add('hidden');
            
            // Reset for new measurements
            this.measurements = new Map();
            this.currentEquipIndex = 0;
            this.currentSpecIndexInGroup = 0;

            // Reset progress tracking table
            this.resetProgressTracking();

            showToast('Measurements saved successfully');

            // Refresh the table if needed
            if (this.currentModelId && window.loadProductMeasurements) {
                await loadProductMeasurements(this.currentModelId);
            }

            // Restart the measurement process
            console.log('🔄 Restarting measurement process');
            this.autoStartMeasuring();

        } catch (error) {
            console.error('Error saving measurements:', error);
            showToast(error.message, 'error');
        }
    }

    startOver() {
        this.removeMeasurementListener();
        console.log('🔄 Starting over measurement process');
        
        // Hide the continue dialog
        const continueDialog = document.getElementById('continue-dialog');
        if (continueDialog) {
            continueDialog.classList.add('hidden');
        }
        
        // Clear all measurements
        this.measurements.clear();
        
        // Reset indices
        this.currentEquipIndex = 0;
        this.currentSpecIndexInGroup = 0;
        
        // Reset UI elements
        const measurementValue = document.getElementById('measurement-value');
        const measurementButtons = document.getElementById('measurement-buttons');
        const measurementPrompt = document.getElementById('measurement-prompt');
        
        if (measurementValue) measurementValue.textContent = '--';
        // if (measurementButtons) measurementButtons.classList.add('hidden');
        if (measurementPrompt) measurementPrompt.classList.remove('hidden');
        
        // Reset progress tracking table
        this.resetProgressTracking();
        
        // Remove any existing measurement listener
        this.removeMeasurementListener();
        
        // Start measuring again
        console.log('▶️ Restarting measurement process');
        this.startCountdown();
        
        console.log('📊 Measurement state after reset:', {
            measurementsSize: this.measurements.size,
            currentEquipIndex: this.currentEquipIndex,
            currentSpecIndexInGroup: this.currentSpecIndexInGroup
        });

        this.measurementHistory = [];
        this.previousSpec = null;
        this.lastMeasurementTime = 0;
    }

    // Helper method to check current state
    logMeasurementState() {
        console.log('📊 Current measurement state:', {
            measurementsSize: this.measurements.size,
            measurements: Array.from(this.measurements.entries()),
            currentEquipIndex: this.currentEquipIndex,
            currentSpecIndexInGroup: this.currentSpecIndexInGroup,
            totalGroups: this.groupedSpecs?.length,
            currentGroupSpecs: this.groupedSpecs[this.currentEquipIndex]?.specs.length
        });
    }

    // Modify cleanup to use new remove method
    cleanup() {
        this.removeMeasurementListener();
        
        // Reset all state
        this.currentSpecIndex = 0;
        this.measurements = new Map();
        this.countdownInterval = null;
        this.currentEquipIndex = 0;
        this.currentSpecIndexInGroup = 0;
        
        // Reset UI elements - thêm kiểm tra null
        const elements = {
            'measurement-prompt': el => el.classList.add('hidden'),
            'measurement-value': el => el.textContent = '--',
            // 'measurement-buttons': el => el.classList.add('hidden'),
            'continue-dialog': el => el.classList.add('hidden'),
            'start-container': el => el.classList.add('hidden'),
            'measurement-start-text': el => el.textContent = 'Đang kiểm tra kết nối tới thiết bị đo...',
            'mold-number-modal': el => el.classList.add('hidden'),
            'measurement-progress': el => el.innerHTML = '',
            'model-images': el => el.innerHTML = ''
        };

        Object.entries(elements).forEach(([id, action]) => {
            const element = document.getElementById(id);
            if (element) {
                action(element);
            }
        });
        
        // Remove keyboard event listener
        document.removeEventListener('keydown', this.handleKeyPress);

        this.measurementHistory = [];
        this.previousSpec = null;

        // Remove space key handler
        if (this.handleSpaceKey) {
            document.removeEventListener('keydown', this.handleSpaceKey);
        }
        this.lastMeasurementTime = 0;

        // Clean up image preview
        const modal = document.getElementById('image-preview-modal');
        if (modal) {
            modal.classList.add('hidden');
            document.body.style.overflow = '';
        }
    }

    // Add method to check if all required measurements are collected
    hasAllRequiredMeasurements() {
        return this.measurements.size >= this.getTotalExpectedMeasurements();
    }

    // Thêm method mới để reset progress tracking
    resetProgressTracking() {
        if (!this.modelSpecs) return;
        
        this.modelSpecs.forEach(spec => {
            const valueCell = document.getElementById(`spec-value-${spec.SpecId}`);
            const row = document.getElementById(`spec-row-${spec.SpecId}`);
            
            if (valueCell) {
                valueCell.innerHTML = '<span class="text-gray-400">Đang chờ...</span>';
            }
            
            if (row) {
                // Remove all styles completely
                row.removeAttribute('style');
                row.classList.remove('bg-blue-50', 'border-l-4', 'border-blue-500');
            }
        });
    }

    remeasurePreviousSpec() {
        if (this.measurementHistory.length === 0) {
            console.log('No measurement history available');
            return;
        }

        this.removeMeasurementListener();
        console.log('Remeasuring previous spec. Current history length:', this.measurementHistory.length);

        // Remove the last measurement from history
        const lastMeasurement = this.measurementHistory.pop();
        console.log('Popped measurement:', lastMeasurement);

        // Remove the measurement for this spec
        if (this.measurements.has(lastMeasurement.spec.SpecId)) {
            this.measurements.delete(lastMeasurement.spec.SpecId);
            console.log('Deleted measurement for SpecId:', lastMeasurement.spec.SpecId);
        }

        // Reset UI for this spec
        const valueCell = document.getElementById(`spec-value-${lastMeasurement.spec.SpecId}`);
        const row = document.getElementById(`spec-row-${lastMeasurement.spec.SpecId}`);
        
        if (valueCell) {
            valueCell.innerHTML = '<span class="text-gray-400">Đang chờ...</span>';
        }
        if (row) {
            row.removeAttribute('style');
            row.classList.remove('bg-blue-50', 'border-l-4', 'border-blue-500');
        }

        // Set indices back to the previous measurement
        this.currentEquipIndex = lastMeasurement.groupIndex;
        this.currentSpecIndexInGroup = lastMeasurement.specIndex;

        console.log('Set indices to:', {
            groupIndex: this.currentEquipIndex,
            specIndex: this.currentSpecIndexInGroup
        });

        // Update remeasure button visibility
        const remeasureButton = document.getElementById('remeasure-prev-spec');
        if (remeasureButton) {
            remeasureButton.classList.toggle('hidden', this.measurementHistory.length === 0);
        }

        // Start measuring the previous spec
        this.startCountdown();
    }

    // Add these new methods to handle image preview
    showImagePreview(imageSrc) {
        const modal = document.getElementById('image-preview-modal');
        const previewImage = document.getElementById('preview-image');
        
        previewImage.src = imageSrc;
        modal.classList.remove('hidden');
        
        // Reset transform when showing new image
        previewImage.style.transform = 'translate(0, 0) scale(1)';
        this.currentZoom = 1;
        this.currentX = 0;
        this.currentY = 0;
        this.isDragging = false;
        
        document.body.style.overflow = 'hidden';
    }

    setupImagePreviewHandlers() {
        const modal = document.getElementById('image-preview-modal');
        const closeBtn = document.getElementById('close-preview');
        const previewImage = document.getElementById('preview-image');
        const container = previewImage.parentElement;

        // Initialize state
        this.currentZoom = 1;
        this.minZoom = 1; // Changed to 1 for original size as minimum
        this.maxZoom = 4;
        this.zoomStep = 0.1;
        this.currentX = 0;
        this.currentY = 0;
        this.isDragging = false;
        this.lastX = 0;
        this.lastY = 0;

        // Close handlers
        closeBtn.onclick = () => this.closeImagePreview();
        modal.onclick = (e) => {
            if (e.target === modal) {
                this.closeImagePreview();
            }
        };

        // Mouse wheel zoom handler
        previewImage.onwheel = (e) => {
            e.preventDefault();
            
            // Get mouse position relative to image
            const rect = previewImage.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            // Calculate zoom
            const delta = e.deltaY < 0 ? 1 : -1;
            const newZoom = this.currentZoom + (delta * this.zoomStep);
            
            // Apply zoom limits
            if (newZoom >= this.minZoom && newZoom <= this.maxZoom) {
                // Calculate cursor position in percentage
                const xPercent = mouseX / rect.width;
                const yPercent = mouseY / rect.height;

                // Calculate how much the image will change in size
                const scaleDiff = newZoom - this.currentZoom;
                
                // Adjust position to zoom towards cursor
                this.currentX -= (rect.width * scaleDiff * xPercent);
                this.currentY -= (rect.height * scaleDiff * yPercent);
                
                this.currentZoom = newZoom;
                
                // Apply transform
                this.updateImageTransform(previewImage);
            }
        };

        // Pan handlers
        previewImage.onmousedown = (e) => {
            if (this.currentZoom > 1) {
                this.isDragging = true;
                this.lastX = e.clientX;
                this.lastY = e.clientY;
                previewImage.style.cursor = 'grabbing';
            }
        };

        document.onmousemove = (e) => {
            if (this.isDragging) {
                const deltaX = e.clientX - this.lastX;
                const deltaY = e.clientY - this.lastY;
                
                this.currentX += deltaX;
                this.currentY += deltaY;
                
                this.lastX = e.clientX;
                this.lastY = e.clientY;
                
                this.updateImageTransform(previewImage);
            }
        };

        document.onmouseup = () => {
            this.isDragging = false;
            previewImage.style.cursor = this.currentZoom > 1 ? 'grab' : 'default';
        };

        // Update cursor based on zoom level
        this.updateCursor = () => {
            previewImage.style.cursor = this.currentZoom > 1 ? 'grab' : 'default';
        };

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
                this.closeImagePreview();
            }
        });
    }

    updateImageTransform(image) {
        image.style.transform = `translate(${this.currentX}px, ${this.currentY}px) scale(${this.currentZoom})`;
        this.updateCursor();
    }

    closeImagePreview() {
        const modal = document.getElementById('image-preview-modal');
        const previewImage = document.getElementById('preview-image');
        
        // Reset all transforms and state
        previewImage.style.transform = 'translate(0, 0) scale(1)';
        this.currentZoom = 1;
        this.currentX = 0;
        this.currentY = 0;
        this.isDragging = false;
        
        modal.classList.add('hidden');
        document.body.style.overflow = '';
    }
}