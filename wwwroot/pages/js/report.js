// Chart configurations
const chartConfigs = {
    production: {
        type: 'bar',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [
                {
                    label: 'OK',
                    data: [150, 142, 160, 145, 155, 140, 148],
                    backgroundColor: 'rgba(59, 130, 246, 0.8)',
                    borderColor: 'rgb(59, 130, 246)',
                    borderWidth: 1
                },
                {
                    label: 'NG',
                    data: [12, 15, 10, 8, 14, 11, 13],
                    backgroundColor: 'rgba(249, 115, 22, 0.8)',
                    borderColor: 'rgb(249, 115, 22)',
                    borderWidth: 1
                }
            ]
        }
    },
    quality: {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Defect Rate (%)',
                data: [],
                borderColor: 'rgba(255, 99, 132, 1)',
                tension: 0.4,
                fill: false
            }]
        }
    }
};

// Initialize charts
const charts = {};
Object.entries(chartConfigs).forEach(([key, config]) => {
    const ctx = document.getElementById(`${key}Chart`).getContext('2d');
    charts[key] = new Chart(ctx, {
        type: config.type,
        data: config.data,
        options: {
            responsive: true,
            maintainAspectRatio: key === 'production' ? false : true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            },
            scales: (config.type === 'bar' || config.type === 'line') ? {
                y: {
                    beginAtZero: true
                }
            } : undefined
        }
    });
});

// Function to get product data
async function getProductData(timeFilter) {
    try {
        const models = await ModelService.getAllModels();
        let allProducts = [];

        // Fetch products for all models
        for (const model of models) {
            const products = await ProductService.getProductsByModelId(model.ModelId);
            const specs = await ModelSpecificationService.getSpecifications(model.ModelId);

            // Enhance products with OK/NG status
            products.forEach(product => {
                try {
                    const isOK = product.Measurements.every(measurement => {
                        const spec = specs.find(s => s.SpecId === measurement.SpecId);
                        if (!spec) return false;
                        return measurement.Value >= spec.MinValue && measurement.Value <= spec.MaxValue;
                    });
                    product.status = isOK ? 'OK' : 'NG';
                } catch (error) {
                    console.error('Error processing product:', error);
                    product.status = 'NG';
                }
            });

            allProducts = [...allProducts, ...products];
        }

        allProducts.sort((a, b) => new Date(a.MeasurementDate + 'Z') - new Date(b.MeasurementDate + 'Z'));

        // Group products based on time filter
        const now = new Date();
        const timeData = { labels: [], ok: [], ng: [] };

        switch (timeFilter) {
            case 'daily':
                // Last 7 days
                for (let i = 6; i >= 0; i--) {
                    const date = new Date(now + 'Z');
                    date.setDate(date.getDate() - i);
                    const dayStr = date.toLocaleDateString('vi-VN', { weekday: 'short' });

                    const dayProducts = allProducts.filter(p =>
                        new Date(p.MeasurementDate + 'Z').toDateString() === date.toDateString()
                    );

                    timeData.labels.push(dayStr);
                    timeData.ok.push(dayProducts.filter(p => p.status === 'OK').length);
                    timeData.ng.push(dayProducts.filter(p => p.status === 'NG').length);
                }
                break;

            case 'weekly':
                // Last 4 weeks
                for (let i = 3; i >= 0; i--) {
                    const weekStart = new Date(now + 'Z');
                    weekStart.setDate(weekStart.getDate() - (i * 7));
                    const weekEnd = new Date(weekStart + 'Z');
                    weekEnd.setDate(weekEnd.getDate() + 6);

                    const weekProducts = allProducts.filter(p => {
                        const date = new Date(p.MeasurementDate + 'Z');
                        date.setHours(0, 0, 0, 0);
                        weekStart.setHours(0, 0, 0, 0);
                        weekEnd.setHours(23, 59, 59, 999);

                        return date >= weekStart && date <= weekEnd;
                    });

                    timeData.labels.push(`Tuần ${4 - i}`);
                    timeData.ok.push(weekProducts.filter(p => p.status === 'OK').length);
                    timeData.ng.push(weekProducts.filter(p => p.status === 'NG').length);
                }
                break;

            case 'monthly':
                // Last 6 months
                for (let i = 5; i >= 0; i--) {
                    const date = new Date(now + 'Z');
                    date.setMonth(date.getMonth() - i);
                    const monthStr = date.toLocaleDateString('vi-VN', { month: 'short' });

                    const monthProducts = allProducts.filter(p => {
                        const prodDate = new Date(p.MeasurementDate + 'Z');
                        return prodDate.getMonth() === date.getMonth() &&
                            prodDate.getFullYear() === date.getFullYear();
                    });

                    timeData.labels.push(monthStr);
                    timeData.ok.push(monthProducts.filter(p => p.status === 'OK').length);
                    timeData.ng.push(monthProducts.filter(p => p.status === 'NG').length);
                }
                break;
        }

        return timeData;
    } catch (error) {
        console.error('Error fetching product data:', error);
        return null;
    }
}

// Function to calculate and update defect rate chart
async function updateDefectRateChart(timeFilter = 'monthly') {
    try {
        const timeData = await getProductData(timeFilter);
        if (!timeData) return;

        const defectRates = timeData.labels.map((_, index) => {
            const total = timeData.ok[index] + timeData.ng[index];
            return total > 0 ? ((timeData.ng[index] / total) * 100).toFixed(1) : 0;
        });

        // Update the quality chart
        charts.quality.data.labels = timeData.labels;
        charts.quality.data.datasets[0].data = defectRates;
        charts.quality.update();

    } catch (error) {
        console.error('Error updating defect rate chart:', error);
    }
}

// Initialize charts on page load
document.addEventListener('DOMContentLoaded', async () => {
    // Set default value for time filter
    $('#productionTimeFilter').val('monthly').trigger('change');
    
    // Update both charts with monthly data
    const initialTimeData = await getProductData('monthly');
    if (initialTimeData) {
        // Update production chart
        charts.production.data.labels = initialTimeData.labels;
        charts.production.data.datasets[0].data = initialTimeData.ok;
        charts.production.data.datasets[1].data = initialTimeData.ng;
        charts.production.update();

        // Update defect rate chart
        await updateDefectRateChart('monthly');
    }
});

// Handle time filter change
$('#productionTimeFilter').on('change', async function (e) {
    const timeFilter = e.target.value;
    const timeData = await getProductData(timeFilter);

    if (timeData) {
        // Update production chart
        charts.production.data.labels = timeData.labels;
        charts.production.data.datasets[0].data = timeData.ok;
        charts.production.data.datasets[1].data = timeData.ng;
        charts.production.update();

        // Update defect rate chart with the same time filter
        await updateDefectRateChart(timeFilter);
    }
});