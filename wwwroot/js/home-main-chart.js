$(document).ready(function () {
    // Initialize Select2 for spec select
    $('#chartSpecSelect').select2({
        placeholder: 'Select Specification',
        allowClear: true,
        width: '250px'
    });

    // Set default date range (last 7 days)
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);

    $('#chartFromDate').val(sevenDaysAgo.toISOString().slice(0, 16));
    $('#chartToDate').val(today.toISOString().slice(0, 16));

    // Add event listeners
    $('#chartFromDate, #chartToDate, #chartSpecSelect').on('change', async function () {
        await refreshChart();
    });
});

// Update the initializeChartSpecSelect function
async function initializeChartSpecSelect(modelId) {
    try {
        const specs = await ModelSpecificationService.getSpecifications(modelId);
        const $specSelect = $('#chartSpecSelect');

        $specSelect.empty().append('<option value="">Select Specification</option>');

        specs.forEach(spec => {
            $specSelect.append(new Option(`${spec.SpecName} (${spec.Unit || ''})`, spec.SpecId));
        });

        // Auto-select first spec if available
        if (specs.length > 0) {
            setTimeout(() => {
                $specSelect.val(specs[0].SpecId).trigger('change');
            }, 100);
        }
    } catch (error) {
        console.error('Error initializing spec select:', error);
    }
}

// Add a helper function for auto-selecting first spec
function autoSelectFirstSpec() {
    const specSelect = document.getElementById('chartSpecSelect');
    if (specSelect.options.length > 1) {
        specSelect.selectedIndex = 1; // Select the first spec (index 1, as index 0 is the default "Select Spec" option)
        $(specSelect).trigger('change');
    }
}

// Add refresh chart function
async function refreshChart() {
    const modelId = $('#modelSelect').val();
    const moldNumber = $('#moldSelect').val();
    const specId = $('#chartSpecSelect').val();

    if (!modelId || !specId) return;

    try {
        const products = await ProductService.getProductsByModelAndMold(modelId, moldNumber);
        const specs = await ModelSpecificationService.getSpecifications(modelId);
        const selectedSpec = specs.find(s => s.SpecId == specId);

        if (products && products.length > 0 && selectedSpec) {
            updateMeasurementChart(products, [selectedSpec]); // Pass only selected spec
        }
    } catch (error) {
        console.error('Error refreshing chart:', error);
    }
}

// Update model select change handler to use autoSelectFirstSpec
$('#modelSelect').on('change', async function () {
    const modelId = $(this).val();
    if (!modelId) return;

    try {
        saveSelectedModel(modelId);
        await updateModelDetails(modelId);
        await loadMoldsForModel(modelId);
        await initializeChartSpecSelect(modelId);
        await refreshMeasurementsTable();

        // Auto-select first spec after a short delay
        setTimeout(autoSelectFirstSpec, 100);
    } catch (error) {
        console.error('Error handling model change:', error);
        showToast(error.message, 'error');
    }
});

// Update mold select change handler
$('#moldSelect').on('change', async function () {
    await refreshChart();
});

// Update the updateMeasurementChart function
function updateMeasurementChart(products, specs) {
    try {
        const ctx = document.getElementById('measurementChart').getContext('2d');
        const fromDate = new Date($('#chartFromDate').val());
        const toDate = new Date($('#chartToDate').val());
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

// Thêm mảng màu đa dạng
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

// Add this function to initialize an empty chart
function initEmptyChart() {
    const ctx = document.getElementById('measurementChart').getContext('2d');

    // Destroy existing chart if it exists
    if (window.measurementChart instanceof Chart) {
        window.measurementChart.destroy();
    }

    // Create new chart with empty dataset
    window.measurementChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'No Data',
                    data: [],
                    borderColor: 'rgb(59, 130, 246)',
                    tension: 0,
                    fill: false
                }

            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: false
                }
            }
        }
    });
}

// Add this helper function to get the currently selected spec
async function getCurrentSelectedSpec(modelId) {
    const specId = $('#chartSpecSelect').val();
    if (!modelId || !specId) return null;

    const specs = await ModelSpecificationService.getSpecifications(modelId);
    return specs.find(s => s.SpecId == specId);
}

// Update the refreshMeasurementsTable function in home.js
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

            // Get the currently selected spec before refreshing
            const selectedSpec = await getCurrentSelectedSpec(modelId);

            // Initialize empty chart first
            initEmptyChart();

            // Get all products for the model
            const allProducts = await ProductService.getProductsByModelId(modelId);

            // Filter products by mold if selected
            const filteredProducts = selectedMold
                ? allProducts.filter(p => p.MoldNumber === selectedMold)
                : allProducts;

            // Load the measurements table
            await loadProductMeasurements(modelId, filteredProducts);

            // Update the chart with only the selected spec if one is selected
            if (selectedSpec) {
                updateMeasurementChart(filteredProducts, [selectedSpec]);
            }
        }
    } catch (error) {
        console.error('❌ Error refreshing measurements:', error);
        showToast('Error refreshing data: ' + error.message, 'error');

        const tableContainer = document.getElementById('measurements-table');
        tableContainer.innerHTML = `
            <div class="text-center py-4 text-red-600">
                <p>Error loading measurements. Please try again.</p>
            </div>
        `;
    }
}