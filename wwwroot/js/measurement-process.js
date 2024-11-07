class MeasurementProcess {
    constructor() {
        //console.log('MeasurementProcess constructor called');
        this.initialize();
    }

    async initialize() {
        //console.log('Initializing MeasurementProcess');
        try {
            this.currentSpecIndex = 0;
            this.measurements = new Map();
            this.countdownInterval = null;
            this.modelSpecs = [];
            this.currentModelId = null;

            // Get initial model if already selected
            const modelSelect = document.getElementById('modelSelect');
            if (modelSelect && modelSelect.value) {
                //console.log('Found existing model selection:', modelSelect.value);
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

            //console.log('Initializing for model:', modelId);
            this.currentModelId = modelId;
            this.currentModelCode = modelCode;
            if (!window.services.modelSpec) {
                throw new Error('Model specification service not available');
            }

            // Use the static method directly
            this.modelSpecs = await ModelSpecificationService.getSpecifications(modelId);
            //console.log('Model specs loaded:', this.modelSpecs);

            if (!this.modelSpecs || !this.modelSpecs.length) {
                // throw new Error('No specifications found for this model');
                showToast('Vui lòng thêm thông số cho model này trước', 'error');
            }

            // Update the current model display (display model name instead of id)
            const currentModelElement = document.getElementById('current-model');
            if (currentModelElement) {
                currentModelElement.textContent = modelCode;
            }

        } catch (error) {
            console.error('Error loading model specifications:', error);
            showToast('Failed to load model specifications: ' + error.message, 'error');
            this.modelSpecs = [];
        }
    }

    setupEventListeners() {
        //console.log('Setting up event listeners');
        const startButton = document.getElementById('start-measuring');
        if (startButton) {
            //console.log('Start button found, adding listener');
            startButton.addEventListener('click', this.startMeasuring.bind(this));
        } else {
            console.error('Start button not found');
        }

        // Also bind other event listeners
        const remeasureButton = document.getElementById('remeasure-button');
        if (remeasureButton) {
            remeasureButton.addEventListener('click', this.startCountdown.bind(this));
        }

        const confirmButton = document.getElementById('confirm-measurement');
        if (confirmButton) {
            confirmButton.addEventListener('click', this.confirmMeasurement.bind(this));
        }

        const continueButton = document.getElementById('continue-measuring');
        if (continueButton) {
            continueButton.addEventListener('click', this.continueNewProduct.bind(this));
        }

        const cancelButton = document.getElementById('cancel-measuring');
        if (cancelButton) {
            cancelButton.addEventListener('click', this.cancelProcess.bind(this));
        }
    }

    startMeasuring() {
        //console.log('startMeasuring called with this:', this);
        //console.log('Current model ID:', this.currentModelId);
        //console.log('Model specs:', this.modelSpecs);

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

        document.getElementById('start-container').classList.add('hidden');
        document.getElementById('measurement-prompt').classList.remove('hidden');
        this.currentSpecIndex = 0;
        this.measurements.clear();
        this.startCountdown();
    }

    startCountdown() {
        const currentSpec = this.modelSpecs[this.currentSpecIndex];
        document.getElementById('current-spec-name').textContent = currentSpec.SpecName;
        document.getElementById('measurement-value').textContent = '--';

        let countdown = 3;
        document.getElementById('countdown').textContent = countdown;
        document.getElementById('countdown-text').textContent = 'Đang đợi dữ liệu đo...';
        document.getElementById('measurement-buttons').classList.add('hidden');

        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
        }

        this.countdownInterval = setInterval(() => {
            countdown--;
            document.getElementById('countdown').textContent = countdown;

            if (countdown === 0) {
                clearInterval(this.countdownInterval);
                document.getElementById('countdown-text').textContent = '';
                document.getElementById('measurement-buttons').classList.remove('hidden');
                this.simulateMeasurement();
            }
        }, 1000);
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
        this.currentSpecIndex++;

        if (this.currentSpecIndex < this.modelSpecs.length) {
            this.startCountdown();
        } else {
            this.showContinueDialog();
        }
    }

    showContinueDialog() {
        const dialog = document.getElementById('continue-dialog');
        const summary = document.getElementById('measurements-summary');

        summary.innerHTML = Array.from(this.measurements.entries()).map(([specId, value]) => {
            const spec = this.modelSpecs.find(s => s.SpecId === specId);
            const isWithinRange = value >= spec.MinValue && value <= spec.MaxValue;
            const valueClass = isWithinRange ? 'text-green-600' : 'text-red-600';

            return `<div class="flex justify-between py-2 border-b">
            <span>${spec.SpecName}</span>
            <span class="${valueClass}">${value} ${spec.Unit}</span>
        </div>`;
        }).join('');

        dialog.classList.remove('hidden');
    }

    async continueNewProduct() {
        try {
            // Save current measurements
            const modelId = this.currentModelId;
            //console.log('Creating new product for model:', modelId);

            // Create new product
            const productData = {
                modelId: modelId,
                measurementDate: new Date().toISOString(),
                status: 'Completed'
            };

            //console.log('Creating product with data:', productData);
            const product = await ProductService.createProduct(productData);
            //console.log('Product created:', product);

            // Save measurements
            const measurementPromises = Array.from(this.measurements.entries()).map(([specId, value]) => {
                const measurementData = {
                    productId: product.ProductId,
                    specId: parseInt(specId),
                    value: value,
                    measurementDate: new Date().toISOString()
                };
                //console.log('Saving measurement:', measurementData);
                return ProductSpecificationService.addMeasurement(measurementData);
            });

            const savedMeasurements = await Promise.all(measurementPromises);
            //console.log('All measurements saved:', savedMeasurements);

            // Update product number display
            const productNumber = document.getElementById('product-number');
            if (productNumber) {
                const currentNumber = parseInt(productNumber.textContent) || 0;
                productNumber.textContent = currentNumber + 1;
            }

            // Hide dialog and restart measurement process
            document.getElementById('continue-dialog').classList.add('hidden');
            document.getElementById('start-container').classList.remove('hidden');
            document.getElementById('measurement-prompt').classList.add('hidden');

            // Clear current measurements
            this.measurements.clear();
            this.currentSpecIndex = 0;

            showToast('Measurements saved successfully');

            // Add this section to refresh the table
            //console.log('Refreshing measurements table...');
            if (modelId) {
                await loadProductMeasurements(modelId);
            }

        } catch (error) {
            console.error('Error saving measurements:', error);
            // showToast('Failed to save measurements: ' + error.message, 'error');
        }
    }

    async cancelProcess() {
        try {
            // Save current measurements if there are any
            if (this.measurements.size > 0) {
                // Create new product
                const productData = {
                    modelId: this.currentModelId,
                    measurementDate: new Date().toISOString(),
                    status: 'Completed'
                };

                //console.log('Creating final product with data:', productData);
                const product = await ProductService.createProduct(productData);
                //console.log('Final product created:', product);

                // Save measurements
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
                //console.log('Final measurements saved');
                showToast('Measurements saved successfully');

                // Refresh the measurements table
                if (this.currentModelId) {
                    await loadProductMeasurements(this.currentModelId);
                }
            }

            // Reset UI
            document.getElementById('continue-dialog').classList.add('hidden');
            document.getElementById('measurement-prompt').classList.add('hidden');
            document.getElementById('start-container').classList.remove('hidden');
            document.getElementById('product-number').textContent = '1';

            if (this.countdownInterval) {
                clearInterval(this.countdownInterval);
            }

            this.currentSpecIndex = 0;
            this.measurements.clear();

            // Close the modal
            closeModal();
            

        } catch (error) {
            // console.error('Error saving final measurements:', error);
            // showToast('Failed to save measurements: ' + error.message, 'error');
        }
    }
}