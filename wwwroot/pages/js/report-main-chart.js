// Initialize clock
function updateClock() {
    const now = new Date();
    $('#clock').text(now.toLocaleTimeString());
    $('#date').text(now.toLocaleDateString());
}
setInterval(updateClock, 1000);
updateClock();

// Initialize Select2
$(document).ready(async function () {
    $('#productionTimeFilter').select2();

    try {
        // 1. Khởi tạo date inputs
        initializeDateInputs();

        // 2. Khởi tạo model select và spec select
        await initializeModelSelect();

        // 3. Khởi tạo các event listeners
        initializeEventListeners();

    } catch (error) {
        console.error('Error during initialization:', error);
    }
});

function initializeDateInputs() {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);

    document.getElementById('fromDate').value = thirtyDaysAgo.toISOString().split('T')[0];
    document.getElementById('toDate').value = today.toISOString().split('T')[0];
}

function initializeEventListeners() {
    // Date change events
    document.getElementById('fromDate').addEventListener('change', handleDateChange);
    document.getElementById('toDate').addEventListener('change', handleDateChange);

    // Mold change event
    $('#moldSelect').on('change', handleMoldChange);
}

async function handleDateChange() {
    const modelId = $('#modelSelect').val();
    if (modelId) {
        await loadProductMeasurements(modelId);
    }
}

async function handleMoldChange() {
    const modelId = $('#modelSelect').val();
    const moldNumber = $(this).val();
    if (modelId) {
        const products = await ProductService.getProductsByModelAndMold(modelId, moldNumber);
        await loadProductMeasurements(modelId, products);
    }
}

async function initializeModelSelect() {
    try {
        const models = await ModelService.getAllModels();
        models.sort((a, b) => a.PartNo.localeCompare(b.PartNo));

        const select = document.getElementById('modelSelect');
        select.innerHTML = '<option value="">Select Model</option>';

        models.forEach(model => {
            const option = document.createElement('option');
            option.value = model.ModelId;
            option.textContent = `${model.PartNo} - ${model.PartName}`;
            select.appendChild(option);
        });

        // Initialize Select2 once
        $(select).select2({
            placeholder: 'Select Model',
            allowClear: true,
            width: '100%',
            dropdownParent: select.parentElement,
            minimumResultsForSearch: 1
        }).on('change', async function () {
            const modelId = $(this).val();
            if (modelId) {
                await initializeSpecSelect(modelId);
                await loadMoldsForModel(modelId);
            } else {
                clearSpecSelect();
            }
        });

        // Load saved model if exists
        const savedModelId = localStorage.getItem('selectedModelId');
        if (savedModelId && models.some(m => m.ModelId.toString() === savedModelId)) {
            $(select).val(savedModelId).trigger('change');
        }
    } catch (error) {
        console.error('Error initializing model select:', error);
    }
}

function clearSpecSelect() {
    const specSelect = document.getElementById('specSelect');
    specSelect.innerHTML = '<option value="">Select Spec</option>';
    $(specSelect).trigger('change');
}

// Thêm event listener cho spec select
document.getElementById('specSelect').addEventListener('change', async function () {
    const modelId = document.getElementById('modelSelect').value;
    const specId = this.value;

    if (modelId && specId) {
        await loadProductMeasurements(modelId);
    }
});

// Thêm các hàm từ home.js
async function loadProductMeasurements(modelId, products = null) {
    if (!modelId) return;

    try {
        const fromDate = document.getElementById('fromDate').value;
        const toDate = document.getElementById('toDate').value;
        const specId = document.getElementById('specSelect').value;

        if (!fromDate || !toDate || !specId) {
            console.log('Please select all filters (From Date, To Date, and Spec)');
            destroyChart();
            return;
        }

        const specs = await ModelSpecificationService.getSpecifications(modelId);
        const selectedSpec = specs.find(spec => spec.SpecId == specId);

        if (!selectedSpec) {
            console.error('Selected spec not found');
            destroyChart();
            return;
        }

        if (!products) {
            products = await ProductService.getProductsByModelId(modelId);
        }

        // Filter products by date range
        const fromDateObj = new Date(fromDate);
        const toDateObj = new Date(toDate);
        toDateObj.setHours(23, 59, 59, 999);

        const filteredProducts = products.filter(product => {
            const productDate = new Date(product.MeasurementDate);
            return productDate >= fromDateObj && productDate <= toDateObj;
        });

        // Check if there are any measurements for the selected spec
        const hasMeasurements = filteredProducts.some(product => 
            product.Measurements.some(m => m.SpecId === selectedSpec.SpecId)
        );

        if (filteredProducts.length > 0 && hasMeasurements) {
            await updateMeasurementChart(filteredProducts, selectedSpec);
        } else {
            console.log('No data found for the selected date range and spec');
            destroyChart();
            
            // Optional: Show a message in the chart area
            const ctx = document.getElementById('measurementChart').getContext('2d');
            ctx.canvas.style.height = '100%';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = '16px Arial';
            ctx.fillStyle = '#666';
            ctx.fillText('No data available for selected filters', 
                ctx.canvas.width / 2, 
                ctx.canvas.height / 2);
        }

    } catch (error) {
        console.error('Error loading measurements:', error);
        destroyChart();
        throw error;
    }
}

// Cập nhật hàm groupAndAverageData
function groupAndAverageData(products, specs, zoomLevel) {
    const groupedProducts = {};

    products.forEach(product => {
        const date = new Date(product.MeasurementDate + 'Z');
        let groupKey;

        switch (zoomLevel) {
            case '24h':
                // Sử dụng timestamp làm key để không gộp các điểm
                groupKey = date.getTime().toString();
                break;
            case '7d':
            case '30d':
                groupKey = date.toLocaleDateString('vi-VN', {
                    year: '2-digit',
                    month: '2-digit',
                    day: '2-digit'
                });
                break;
        }

        if (!groupedProducts[groupKey]) {
            groupedProducts[groupKey] = [];
        }
        groupedProducts[groupKey].push(product);
    });

    const labels = [];
    const averagedData = {};

    specs.forEach(spec => {
        averagedData[spec.SpecId] = [];
    });

    Object.entries(groupedProducts)
        .sort(([dateA], [dateB]) => {
            // Sắp xếp theo timestamp cho chế độ 24h
            if (zoomLevel === '24h') {
                return parseInt(dateA) - parseInt(dateB);
            }
            return new Date(dateA + 'Z') - new Date(dateB + 'Z');
        })
        .forEach(([dateKey, groupProducts]) => {
            // Format label dựa trên zoom level
            let label;
            if (zoomLevel === '24h') {
                const date = new Date(parseInt(dateKey + 'Z'));
                label = date.toLocaleString('vi-VN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                });
            } else {
                label = dateKey;
            }
            labels.push(label);

            specs.forEach(spec => {
                if (zoomLevel === '24h') {
                    // Không tính trung bình cho chế độ 24h
                    const measurement = groupProducts[0].Measurements.find(m => m.SpecId === spec.SpecId);
                    averagedData[spec.SpecId].push(measurement ? measurement.Value : null);
                } else {
                    // Tính trung bình cho cc chế độ khác
                    const values = groupProducts
                        .map(product => {
                            const measurement = product.Measurements.find(m => m.SpecId === spec.SpecId);
                            return measurement ? measurement.Value : null;
                        })
                        .filter(value => value !== null);

                    const average = values.length > 0
                        ? values.reduce((sum, val) => sum + val, 0) / values.length
                        : null;

                    averagedData[spec.SpecId].push(average);
                }
            });
        });

    return { labels, averagedData };
}

// Thêm mảng màu đa dạng vào đầu file
const SPEC_COLORS = [
    'rgb(59, 130, 246)',   // Blue
    'rgb(249, 115, 22)',   // Orange
    'rgb(139, 92, 246)',   // Purple
    'rgb(34, 197, 94)',    // Green
    'rgb(236, 72, 153)',   // Pink
    'rgb(234, 179, 8)',    // Yellow
    'rgb(14, 165, 233)',   // Light Blue
    'rgb(168, 85, 247)',   // Violet
    'rgb(239, 68, 68)',    // Red
    'rgb(20, 184, 166)',   // Teal
];

// Thêm biến global để quản lý chart instance
let measurementChart = null;

// Thêm hàm để destroy chart an toàn
function destroyChart() {
    if (measurementChart) {
        measurementChart.destroy();
        measurementChart = null;
    }
}

// Thêm hàm helper để tính số ngày giữa 2 ngày
function getDaysBetweenDates(fromDate, toDate) {
    const diffTime = Math.abs(toDate - fromDate);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Thêm hàm helper để xác định đơn vị thời gian phù hợp
function determineTimeUnit(fromDate, toDate) {
    const days = getDaysBetweenDates(fromDate, toDate);
    if (days <= 31) return 'day';
    if (days <= 180) return 'week';
    if (days <= 730) return 'month';
    return 'year';
}

// Cập nhật hàm updateMeasurementChart
function updateMeasurementChart(products, selectedSpec) {
    try {
        // Destroy existing chart
        destroyChart();

        const ctx = document.getElementById('measurementChart').getContext('2d');

        // Group measurements by date
        const measurementsByDate = {};

        products.forEach(product => {
            const dateStr = product.MeasurementDate.split('T')[0];
            if (!measurementsByDate[dateStr]) {
                measurementsByDate[dateStr] = [];
            }

            const measurements = product.Measurements
                .filter(m => m.SpecId === selectedSpec.SpecId)
                .map(m => m.Value);

            measurementsByDate[dateStr].push(...measurements);
        });

        // Calculate daily stats
        const dailyStats = Object.entries(measurementsByDate)
            .map(([date, values]) => ({
                date,
                min: Math.min(...values),
                max: Math.max(...values),
                avg: values.reduce((sum, val) => sum + val, 0) / values.length
            }))
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        const datasets = [
            {
                label: `${selectedSpec.SpecName} Average`,
                data: dailyStats.map(stat => ({
                    x: new Date(stat.date),
                    y: stat.avg
                })),
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgb(75, 192, 192)',
                tension: 0.4,
                fill: false,
                borderWidth: 2,
                pointRadius: 3,
                pointHoverRadius: 5,
                hitRadius: 10
            },
            {
                label: `${selectedSpec.SpecName} Min`,
                data: dailyStats.map(stat => ({
                    x: new Date(stat.date),
                    y: stat.min
                })),
                borderColor: 'rgba(255, 0, 0, 1.0)', // Red color with full opacity
                borderDash: [5, 3],
                tension: 0.4,
                fill: false,
                borderWidth: 1.5,
                pointRadius: 2,
                hitRadius: 10
            },
            {
                label: `${selectedSpec.SpecName} Max`,
                data: dailyStats.map(stat => ({
                    x: new Date(stat.date),
                    y: stat.max
                })),
                borderColor: 'rgba(0, 255, 0, 1.0)', // Green color with full opacity
                borderDash: [5, 3],
                tension: 0.4,
                fill: {
                    target: '-1',
                    above: 'rgba(75, 192, 192, 0.1)'
                },
                borderWidth: 1.5,
                pointRadius: 2,
                hitRadius: 10
            }
        ];

        // Add spec limits if available
        // if (selectedSpec.MinValue !== null) {
        //     datasets.push({
        //         label: 'Spec Min',
        //         data: dailyStats.map(stat => ({
        //             x: new Date(stat.date),
        //             y: selectedSpec.MinValue
        //         })),
        //         borderColor: 'rgba(0, 0, 0, 0.5)', // gray color with full opacity
        //         borderDash: [10, 5],
        //         borderWidth: 1,
        //         pointRadius: 0,
        //         hitRadius: 0,
        //         fill: false
        //     });
        // }

        // if (selectedSpec.MaxValue !== null) {
        //     datasets.push({
        //         label: 'Spec Max',
        //         data: dailyStats.map(stat => ({
        //             x: new Date(stat.date),
        //             y: selectedSpec.MaxValue
        //         })),
        //         borderColor: 'rgba(0, 0, 0, 0.5)', // Green color with full opacity
        //         borderDash: [10, 5],
        //         borderWidth: 1,
        //         pointRadius: 0,
        //         hitRadius: 0,
        //         fill: false
        //     });
        // }

        // Create new chart
        measurementChart = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            filter: function (legendItem) {
                                return !legendItem.text.includes('Limit');
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            title: function (context) {
                                const date = new Date(context[0].raw.x);
                                return date.toLocaleDateString('vi-VN', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric'
                                });
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'day',
                            displayFormats: {
                                day: 'dd/MM/yyyy'
                            }
                        },
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45,
                            callback: function (value) {
                                const date = new Date(value);
                                return date.toLocaleDateString('vi-VN', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric'
                                });
                            }
                        }
                    },
                    y: {
                        beginAtZero: false
                    }
                }
            }
        });

    } catch (error) {
        console.error('Error updating measurement chart:', error);
        throw error;
    }
}


// Thêm các event listeners cho model và mold select
$(document).ready(function () {
    $('#modelSelect, #specSelect').select2({
        placeholder: 'Select...',
        allowClear: true,
        width: '100%'
    });
    $('#moldSelect').select2();



    $('#modelSelect').on('change', async function () {
        const modelId = $(this).val();
        if (modelId) {
            const products = await ProductService.getProductsByModelId(modelId);
            await loadProductMeasurements(modelId, products);
            await loadMoldsForModel(modelId);
            autoSelectFirstSpec();
        }
    });

    $('#moldSelect').on('change', async function () {
        const modelId = $('#modelSelect').val();
        const moldNumber = $(this).val();
        if (modelId) {
            const products = await ProductService.getProductsByModelAndMold(modelId, moldNumber);
            await loadProductMeasurements(modelId, products);
        }
    });

    $('#zoomLevel').select2();

    $('#zoomLevel').on('change', async function () {
        const modelId = $('#modelSelect').val();
        const moldNumber = $('#moldSelect').val();
        if (modelId) {
            const products = await ProductService.getProductsByModelAndMold(modelId, moldNumber);
            if (products && products.length > 0) {
                const specs = await ModelSpecificationService.getSpecifications(modelId);
                updateMeasurementChart(products, specs);
            }
        }
    });

    setTimeout(() => {
        // Auto-select the first spec option after loading specs
        autoSelectFirstSpec();
    }, 1000);
});

function autoSelectFirstSpec() {
    const specSelect = document.getElementById('specSelect');
    if (specSelect.options.length > 1) {
        specSelect.selectedIndex = 1; // Select the first spec (index 1, as index 0 is the default "Select Spec" option)
        $(specSelect).trigger('change');
    }
}

async function loadMoldsForModel(modelId) {
    try {
        const products = await ProductService.getProductsByModelId(modelId);
        const uniqueMolds = [...new Set(products
            .map(p => p.MoldNumber)
            .filter(mold => mold && mold.trim() !== ''))]
            .sort();

        const $moldSelect = $('#moldSelect');
        $moldSelect.empty();
        $moldSelect.append(new Option('All Molds', ''));

        uniqueMolds.forEach(mold => {
            $moldSelect.append(new Option(mold, mold));
        });

        $moldSelect.val('').trigger('change');
    } catch (error) {
        console.error('Error loading molds:', error);
    }
}

// Cập nhật hàm khởi tạo spec select
async function initializeSpecSelect(modelId) {
    try {
        console.log('Loading specs for model:', modelId);
        const specs = await ModelSpecificationService.getSpecifications(modelId);
        console.log('Loaded specs:', specs);

        const specSelect = document.getElementById('specSelect');
        specSelect.innerHTML = '<option value="">Select Spec</option>';

        if (specs && specs.length > 0) {
            specs.forEach(spec => {
                const option = document.createElement('option');
                option.value = spec.SpecId;
                option.textContent = `${spec.SpecName} (${spec.Unit || ''})`;
                specSelect.appendChild(option);
            });

            // Reinitialize Select2 for spec select
            $(specSelect).select2({
                placeholder: 'Select Specification',
                allowClear: true,
                width: '100%',
                dropdownParent: specSelect.parentElement
            });

            // Add change event listener for spec select
            $(specSelect).on('change', async function () {
                const specId = $(this).val();
                if (modelId && specId) {
                    await loadProductMeasurements(modelId);
                }
            });

        } else {
            console.warn('No specs found for model:', modelId);
        }
    } catch (error) {
        console.error('Error loading specs:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack
        });
    }
}
