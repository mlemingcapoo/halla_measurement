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
    const yesterday = new Date(today);
    const tomorrow = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    tomorrow.setDate(today.getDate() + 1);

    // Format datetime-local strings
    document.getElementById('fromDate').value = yesterday.toISOString().slice(0, 16);
    document.getElementById('toDate').value = tomorrow.toISOString().slice(0, 16);
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
        const selectedMold = $('#moldSelect').val();

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

        const filteredProducts = selectedMold
                ? products.filter(p => p.MoldNumber === selectedMold)
                : products; 
        
    

        // Filter products by date range
        // const fromDateObj = new Date(fromDate);
        // const toDateObj = new Date(toDate);
        // toDateObj.setHours(23, 59, 59, 999);

        // const filteredProducts = products.filter(product => {
        //     const productDate = new Date(product.MeasurementDate);
        //     return productDate >= fromDateObj && productDate <= toDateObj;
        // });

        // Check if there are any measurements for the selected spec
        // const hasMeasurements = filteredProducts.some(product =>
        //     product.Measurements.some(m => m.SpecId === selectedSpec.SpecId)
        // );

        if (filteredProducts.length > 0 && selectedSpec) {
            await updateMeasurementChart(filteredProducts, [selectedSpec]);
        } else {
            console.log('No data found for the selected date range and spec');
            destroyChart();

            // Show a message in the chart area
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
// Helper functions for grouping measurements
function groupMeasurementsByTime(products, spec) {
    const measurementsByTime = {};

    products.forEach(product => {
        const measurement = product.Measurements.find(m => m.SpecId === spec.SpecId);
        if (measurement) {
            const timeKey = new Date(product.MeasurementDate + 'Z').getTime();
            if (!measurementsByTime[timeKey]) {
                measurementsByTime[timeKey] = [];
            }
            measurementsByTime[timeKey].push(measurement.Value);
        }
    });

    return Object.entries(measurementsByTime)
        .map(([timeKey, values]) => ({
            time: new Date(parseInt(timeKey)),
            min: Math.min(...values),
            max: Math.max(...values)
        }))
        .sort((a, b) => a.time - b.time);
}

function groupMeasurementsByDay(products, spec) {
    const measurementsByDate = {};

    products.forEach(product => {
        const measurement = product.Measurements.find(m => m.SpecId === spec.SpecId);
        if (measurement) {
            const dateStr = new Date(product.MeasurementDate + 'Z').toISOString().split('T')[0];
            if (!measurementsByDate[dateStr]) {
                measurementsByDate[dateStr] = [];
            }
            measurementsByDate[dateStr].push(measurement.Value);
        }
    });

    return Object.entries(measurementsByDate)
        .map(([date, values]) => ({
            time: new Date(date),
            min: Math.min(...values),
            max: Math.max(...values)
        }))
        .sort((a, b) => a.time - b.time);
}

// Update the groupAndAverageData function
function groupAndAverageData(products, specs) {
    const groupedProducts = {};

    products.forEach(product => {
        const date = new Date(product.MeasurementDate);
        const groupKey = date.toLocaleDateString('vi-VN', {
            year: '2-digit',
            month: '2-digit',
            day: '2-digit'
        });

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
            return new Date(dateA.split('/').reverse().join('-')) -
                new Date(dateB.split('/').reverse().join('-'));
        })
        .forEach(([dateKey, groupProducts]) => {
            labels.push(dateKey);

            specs.forEach(spec => {
                // Calculate average for each spec
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

function updateMeasurementChart(products, specs) {
    try {
        const ctx = document.getElementById('measurementChart').getContext('2d');
        const fromDate = new Date($('#fromDate').val());
        const toDate = new Date($('#toDate').val());
        console.log(toDate);
        console.log(fromDate);

        if (window.measurementChart instanceof Chart) {
            window.measurementChart.destroy();
        }

        // Fix the date filtering to include time
        const filteredProducts = products.filter(product => {
            const productDate = new Date(product.MeasurementDate + 'Z');
            return productDate >= fromDate && productDate <= toDate;
        });

        // Calculate time difference in hours
        const hoursDiff = (toDate - fromDate) / (1000 * 60 * 60);
        const isWithin24Hours = hoursDiff <= 24;

        const datasets = [];
        specs.forEach((spec, index) => {
            const colorIndex = index % SPEC_COLORS.length;
            const mainColor = SPEC_COLORS[colorIndex];

            if (isWithin24Hours) {
                // For 24h view - show actual measurements
                const measurements = filteredProducts
                    .flatMap(product => {
                        const measurement = product.Measurements.find(m => m.SpecId === spec.SpecId);
                        if (measurement) {
                            return [{
                                time: new Date(product.MeasurementDate + 'Z'),
                                value: measurement.Value
                            }];
                        }
                        return [];
                    })
                    .sort((a, b) => a.time - b.time);

                // Get all measurements for this spec
                const allMeasurements = filteredProducts
                    .flatMap(product => {
                        const measurement = product.Measurements.find(m => m.SpecId === spec.SpecId);
                        if (measurement) {
                            return [{
                                time: new Date(product.MeasurementDate + 'Z'),
                                value: measurement.Value
                            }];
                        }
                        return [];
                    })
                    .sort((a, b) => a.time - b.time);

                // Add actual values line
                datasets.push({
                    label: spec.SpecName,
                    data: measurements.map(m => ({
                        x: m.time,
                        y: m.value
                    })),
                    borderColor: mainColor,
                    backgroundColor: mainColor,
                    tension: 0.4,
                    fill: false,
                    borderWidth: 2,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    hitRadius: 10,
                    specIndex: index
                });

                // Add specification min line
                datasets.push({
                    label: `${spec.SpecName} Min`,
                    data: allMeasurements.map(m => ({
                        x: m.time,
                        y: spec.MinValue
                    })),
                    borderColor: 'rgba(255, 0, 0, 1.0)',
                    borderDash: [5, 3],
                    tension: 0,
                    fill: false,
                    borderWidth: 1.5,
                    pointRadius: 0,
                    hitRadius: 10,
                    specIndex: index
                });

                // Add specification max line
                datasets.push({
                    label: `${spec.SpecName} Max`,
                    data: allMeasurements.map(m => ({
                        x: m.time,
                        y: spec.MaxValue
                    })),
                    borderColor: 'rgba(0, 255, 0, 1.0)',
                    borderDash: [5, 3],
                    tension: 0,
                    fill: {
                        target: '-1',
                        above: mainColor.replace('rgb', 'rgba').replace(')', ', 0.1)')
                    },
                    borderWidth: 1.5,
                    pointRadius: 0,
                    hitRadius: 10,
                    specIndex: index
                });

                

            } else {
                // For daily view - group by date and calculate stats
                const measurementsByDate = {};

                filteredProducts.forEach(product => {
                    const measurement = product.Measurements.find(m => m.SpecId === spec.SpecId);
                    if (measurement) {
                        const dateStr = new Date(product.MeasurementDate + 'Z').toISOString().split('T')[0];
                        if (!measurementsByDate[dateStr]) {
                            measurementsByDate[dateStr] = [];
                        }
                        measurementsByDate[dateStr].push(measurement.Value);
                    }
                });

                // Calculate daily stats
                const dailyStats = Object.entries(measurementsByDate)
                    .map(([date, values]) => ({
                        time: new Date(date),
                        min: Math.min(...values),
                        max: Math.max(...values),
                        avg: values.reduce((sum, val) => sum + val, 0) / values.length
                    }))
                    .sort((a, b) => a.time - b.time);

                // Add average line
                datasets.push({
                    label: `${spec.SpecName} Avg`,
                    data: dailyStats.map(stat => ({
                        x: stat.time,
                        y: stat.avg
                    })),
                    borderColor: mainColor,
                    backgroundColor: mainColor,
                    tension: 0.4,
                    fill: false,
                    borderWidth: 2,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    hitRadius: 10,
                    specIndex: index
                });
                // Add min/max lines for both views
                const timeStats = isWithin24Hours
                    ? groupMeasurementsByTime(filteredProducts, spec)
                    : groupMeasurementsByDay(filteredProducts, spec);

                // Add min line
                datasets.push({
                    label: `${spec.SpecName} Min`,
                    data: timeStats.map(stat => ({
                        x: stat.time,
                        y: stat.min
                    })),
                    borderColor: 'rgba(255, 0, 0, 1.0)',
                    borderDash: [5, 3],
                    tension: 0.4,
                    fill: false,
                    borderWidth: 1.5,
                    pointRadius: 2,
                    hitRadius: 10,
                    specIndex: index
                });

                // Add max line
                datasets.push({
                    label: `${spec.SpecName} Max`,
                    data: timeStats.map(stat => ({
                        x: stat.time,
                        y: stat.max
                    })),
                    borderColor: 'rgba(0, 255, 0, 1.0)',
                    borderDash: [5, 3],
                    tension: 0.4,
                    fill: {
                        target: '-1',
                        above: mainColor.replace('rgb', 'rgba').replace(')', ', 0.1)')
                    },
                    borderWidth: 1.5,
                    pointRadius: 2,
                    hitRadius: 10,
                    specIndex: index
                });

                // // Add spec limits if available
                // if (selectedSpec.MinValue !== null) {
                    datasets.push({
                        label: 'Spec Min',
                        data: dailyStats.map(stat => ({
                            x: new Date(stat.time),
                            y: stat.min
                        })),
                        borderColor: 'rgba(0, 0, 0, 0.5)', // gray color with full opacity
                        borderDash: [10, 5],
                        borderWidth: 1,
                        pointRadius: 0,
                        hitRadius: 0,
                        fill: false
                    });
                // }

                // if (selectedSpec.MaxValue !== null) {
                    datasets.push({
                        label: 'Spec Max',
                        data: dailyStats.map(stat => ({
                            x: new Date(stat.time),
                            y: stat.max
                        })),
                        borderColor: 'rgba(0, 0, 0, 0.5)', // Green color with full opacity
                        borderDash: [10, 5],
                        borderWidth: 1,
                        pointRadius: 0,
                        hitRadius: 0,
                        fill: false
                    });
                // }
            }

        });

        window.measurementChart = new Chart(ctx, {
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
                        onClick: function (e, legendItem, legend) {
                            const index = legendItem.datasetIndex;
                            const chart = legend.chart;
                            const clickedDataset = chart.data.datasets[index];

                            // Hide all datasets first
                            chart.data.datasets.forEach((dataset, i) => {
                                chart.getDatasetMeta(i).hidden = true;
                            });

                            // Show clicked dataset and its related min/max lines
                            const specIndex = clickedDataset.specIndex;
                            chart.data.datasets.forEach((dataset, i) => {
                                if (dataset.specIndex === specIndex) {
                                    chart.getDatasetMeta(i).hidden = false;
                                }
                            });

                            chart.update();
                        }
                    },
                    tooltip: {
                        callbacks: {
                            title: function (context) {
                                const date = new Date(context[0].raw.x);
                                return date.toLocaleString('vi-VN', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                });
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: isWithin24Hours ? 'hour' : 'day',
                            displayFormats: {
                                hour: 'HH:mm',
                                day: 'dd/MM'
                            }
                        },
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45,
                            autoSkip: true,
                            maxTicksLimit: 10,
                            callback: function (value) {
                                const date = new Date(value);
                                if (isWithin24Hours) {
                                    return date.toLocaleTimeString('vi-VN', {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    });
                                }
                                return date.toLocaleDateString('vi-VN', {
                                    day: '2-digit',
                                    month: '2-digit'
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

        window.measurementChart.update();

    } catch (error) {
        console.error('Error updating measurement chart:', error);
        throw error;
    }
}

// Update the updateMeasurementChart function
// function updateMeasurementChart(products, selectedSpec) {
//     try {
//         // Destroy existing chart
//         destroyChart();

//         const ctx = document.getElementById('measurementChart').getContext('2d');
//         const fromDate = new Date($('#fromDate').val());
//         const toDate = new Date($('#toDate').val());
//         // toDate.setHours(23, 59, 59, 999); // Set to end of day
//         console.log(toDate);
//         console.log(fromDate);

//         // Filter products by date range
//         const filteredProducts = products.filter(product => {
//             const productDate = new Date(product.MeasurementDate + 'Z');
//             return productDate >= fromDate && productDate <= toDate;
//         });

//         // Calculate time difference in hours
//         const hoursDiff = (toDate - fromDate) / (1000 * 60 * 60);
//         const isWithin24Hours = hoursDiff <= 24;

//         const datasets = [];
//         const mainColor = 'rgb(75, 192, 192)';

//         if (isWithin24Hours) {
//             // For 24h view - show actual measurements
//             const measurements = filteredProducts
//                 .flatMap(product => {
//                     const measurement = product.Measurements.find(m => m.SpecId === selectedSpec.SpecId);
//                     if (measurement) {
//                         return [{
//                             time: new Date(product.MeasurementDate + 'Z'),
//                             value: measurement.Value
//                         }];
//                     }
//                     return [];
//                 })
//                 .sort((a, b) => a.time - b.time);

//             // Get all measurements for this spec
//             const allMeasurements = filteredProducts
//                 .flatMap(product => {
//                     const measurement = product.Measurements.find(m => m.SpecId === spec.SpecId);
//                     if (measurement) {
//                         return [{
//                             time: new Date(product.MeasurementDate + 'Z'),
//                             value: measurement.Value
//                         }];
//                     }
//                     return [];
//                 })
//                 .sort((a, b) => a.time - b.time);

//             // Add actual values line
//             datasets.push({
//                 label: selectedSpec.SpecName,
//                 data: measurements.map(m => ({
//                     x: m.time,
//                     y: m.value
//                 })),
//                 borderColor: mainColor,
//                 backgroundColor: mainColor,
//                 tension: 0.4,
//                 fill: false,
//                 borderWidth: 2,
//                 pointRadius: 3,
//                 pointHoverRadius: 5,
//                 hitRadius: 10
//             });
//             // Add specification min line
//             datasets.push({
//                 label: `${spec.SpecName} Min`,
//                 data: allMeasurements.map(m => ({
//                     x: m.time,
//                     y: spec.MinValue
//                 })),
//                 borderColor: 'rgba(255, 0, 0, 1.0)',
//                 borderDash: [5, 3],
//                 tension: 0,
//                 fill: false,
//                 borderWidth: 1.5,
//                 pointRadius: 0,
//                 hitRadius: 10,
//                 specIndex: index
//             });

//             // Add specification max line
//             datasets.push({
//                 label: `${spec.SpecName} Max`,
//                 data: allMeasurements.map(m => ({
//                     x: m.time,
//                     y: spec.MaxValue
//                 })),
//                 borderColor: 'rgba(0, 255, 0, 1.0)',
//                 borderDash: [5, 3],
//                 tension: 0,
//                 fill: {
//                     target: '-1',
//                     above: mainColor.replace('rgb', 'rgba').replace(')', ', 0.1)')
//                 },
//                 borderWidth: 1.5,
//                 pointRadius: 0,
//                 hitRadius: 10,
//                 specIndex: index
//             });
//         } else {
//             // For daily view - group by date and calculate stats
//             const measurementsByDate = {};

//             filteredProducts.forEach(product => {
//                 const measurement = product.Measurements.find(m => m.SpecId === selectedSpec.SpecId);
//                 if (measurement) {
//                     const dateStr = new Date(product.MeasurementDate + 'Z').toISOString().split('T')[0];
//                     if (!measurementsByDate[dateStr]) {
//                         measurementsByDate[dateStr] = [];
//                     }
//                     measurementsByDate[dateStr].push(measurement.Value);
//                 }
//             });

//             // Calculate daily stats
//             const dailyStats = Object.entries(measurementsByDate)
//                 .map(([date, values]) => ({
//                     time: new Date(date),
//                     min: Math.min(...values),
//                     max: Math.max(...values),
//                     avg: values.reduce((sum, val) => sum + val, 0) / values.length
//                 }))
//                 .sort((a, b) => a.time - b.time);

//             // Add average line
//             datasets.push({
//                 label: `${selectedSpec.SpecName} Average`,
//                 data: dailyStats.map(stat => ({
//                     x: stat.time,
//                     y: stat.avg
//                 })),
//                 borderColor: mainColor,
//                 backgroundColor: mainColor,
//                 tension: 0.4,
//                 fill: false,
//                 borderWidth: 2,
//                 pointRadius: 3,
//                 pointHoverRadius: 5,
//                 hitRadius: 10
//             });

//             // Add min line
//             datasets.push({
//                 label: `${selectedSpec.SpecName} Min`,
//                 data: dailyStats.map(stat => ({
//                     x: stat.time,
//                     y: stat.min
//                 })),
//                 borderColor: 'rgba(255, 0, 0, 1.0)',
//                 borderDash: [5, 3],
//                 tension: 0.4,
//                 fill: false,
//                 borderWidth: 1.5,
//                 pointRadius: 2,
//                 hitRadius: 10
//             });

//             // Add max line
//             datasets.push({
//                 label: `${selectedSpec.SpecName} Max`,
//                 data: dailyStats.map(stat => ({
//                     x: stat.time,
//                     y: stat.max
//                 })),
//                 borderColor: 'rgba(0, 255, 0, 1.0)',
//                 borderDash: [5, 3],
//                 tension: 0.4,
//                 fill: {
//                     target: '-1',
//                     above: mainColor.replace('rgb', 'rgba').replace(')', ', 0.1)')
//                 },
//                 borderWidth: 1.5,
//                 pointRadius: 2,
//                 hitRadius: 10
//             });
//         }

//         // Create new chart
//         measurementChart = new Chart(ctx, {
//             type: 'line',
//             data: {
//                 datasets: datasets
//             },
//             options: {
//                 responsive: true,
//                 maintainAspectRatio: false,
//                 interaction: {
//                     intersect: false,
//                     mode: 'index'
//                 },
//                 plugins: {
//                     legend: {
//                         position: 'top',
//                         labels: {
//                             filter: function (legendItem) {
//                                 return !legendItem.text.includes('Limit');
//                             }
//                         }
//                     },
//                     tooltip: {
//                         callbacks: {
//                             title: function (context) {
//                                 const date = new Date(context[0].raw.x);
//                                 return date.toLocaleString('vi-VN', {
//                                     day: '2-digit',
//                                     month: '2-digit',
//                                     year: 'numeric',
//                                     hour: isWithin24Hours ? '2-digit' : undefined,
//                                     minute: isWithin24Hours ? '2-digit' : undefined
//                                 });
//                             }
//                         }
//                     }
//                 },
//                 scales: {
//                     x: {
//                         type: 'time',
//                         time: {
//                             unit: isWithin24Hours ? 'hour' : 'day',
//                             displayFormats: {
//                                 hour: 'HH:mm',
//                                 day: 'dd/MM/yyyy'
//                             }
//                         },
//                         ticks: {
//                             maxRotation: 45,
//                             minRotation: 45,
//                             callback: function (value) {
//                                 const date = new Date(value);
//                                 if (isWithin24Hours) {
//                                     return date.toLocaleTimeString('vi-VN', {
//                                         hour: '2-digit',
//                                         minute: '2-digit'
//                                     });
//                                 }
//                                 return date.toLocaleDateString('vi-VN', {
//                                     day: '2-digit',
//                                     month: '2-digit',
//                                     year: 'numeric'
//                                 });
//                             }
//                         }
//                     },
//                     y: {
//                         beginAtZero: false
//                     }
//                 }
//             }
//         });

//     } catch (error) {
//         console.error('Error updating measurement chart:', error);
//         throw error;
//     }
// }


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
        // try {
        //     const products = await ProductService.getProductsByModelAndMold(modelId, moldNumber);
        //     const specs = await ModelSpecificationService.getSpecifications(modelId);
        //     const selectedSpec = specs.find(s => s.SpecId == specId);
    
        //     if (products && products.length > 0 && selectedSpec) {
        //         updateMeasurementChart(products, [selectedSpec]); // Pass only selected spec
        //     }
        // } catch (error) {
        //     console.error('Error refreshing chart:', error);
        // }
        if (modelId) {
            const products = await ProductService.getProductsByModelAndMold(modelId, moldNumber);
            if (products && products.length > 0) {
                const specs = await ModelSpecificationService.getSpecifications(modelId);
                const selectedSpec = specs.find(s => s.SpecId == $('#specSelect').val());
                // updateMeasurementChart(products, [specs]);
                if (products && products.length > 0 && selectedSpec) {
                    updateMeasurementChart(products, [selectedSpec]); // Pass only selected spec
                }
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

