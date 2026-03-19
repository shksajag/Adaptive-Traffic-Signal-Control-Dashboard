// ===== Configuration =====
const CONFIG = {
    basePath: '..',
    models: {
        dqn: { name: 'DQN', color: '#2e6b8a', path: 'models_dqn' },
        fixed: { name: 'Fixed-Time', color: '#b8860b', path: 'models_fixed' }
    },
    // Metrics available per data type
    trainingMetrics: {
        reward: { name: 'Cumulative Reward', file: 'plot_reward_data.txt', unit: '', lowerIsBetter: false }
    },
    testingMetrics: {
        queue: { name: 'Queue Length', file: 'plot_queue_data.txt', unit: 'vehicles', lowerIsBetter: true },
        waiting: { name: 'Avg Waiting Time', file: 'plot_avg_waiting_time_data.txt', unit: 'seconds', lowerIsBetter: true }
    }
};

// Fixed-Time version mapping to DQN model version
const FIXED_VERSION_MAP = {
    '10': '1000',        // Off-Peak -> 1000 baseline
    '16': '2000_rev'     // Peak -> 2000_rev baseline
};

// ===== State Management =====
let state = {
    modelVersion: '10',
    dataType: 'training',
    metric: 'queue',
    data: {}
};

let timeSeriesChart = null;
let comparisonChart = null;

// ===== Initialization =====
document.addEventListener('DOMContentLoaded', () => {
    initializeControls();
    populateMetricOptions();
    loadAllData();
});

function initializeControls() {
    // Model version select
    document.getElementById('model-version').addEventListener('change', (e) => {
        state.modelVersion = e.target.value;
        loadAllData();
    });

    // Data type toggle
    document.querySelectorAll('#data-type-toggle .toggle-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('#data-type-toggle .toggle-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            state.dataType = e.target.dataset.value;
            populateMetricOptions();
            loadAllData();
        });
    });

    // Metric select
    document.getElementById('metric-select').addEventListener('change', (e) => {
        state.metric = e.target.value;
        updateVisualizations();
    });
}

function populateMetricOptions() {
    const select = document.getElementById('metric-select');
    const metrics = getActiveMetrics();

    select.innerHTML = '';
    for (const [key, metric] of Object.entries(metrics)) {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = metric.name;
        select.appendChild(option);
    }

    // Reset to first metric if current isn't available
    if (!metrics[state.metric]) {
        state.metric = Object.keys(metrics)[0];
    }
    select.value = state.metric;
}

function getActiveMetrics() {
    return state.dataType === 'training' ? CONFIG.trainingMetrics : CONFIG.testingMetrics;
}

function getActiveModels() {
    // Training: DQN only. Testing: both DQN and Fixed-Time
    if (state.dataType === 'training') {
        return ['dqn'];
    }
    return ['dqn', 'fixed'];
}

// ===== Data Loading =====
async function loadAllData() {
    showLoading();

    const promises = [];

    // Always load all models and all metrics from both sets
    const allMetrics = { ...CONFIG.trainingMetrics, ...CONFIG.testingMetrics };

    for (const modelKey of Object.keys(CONFIG.models)) {
        for (const metricKey of Object.keys(allMetrics)) {
            promises.push(loadModelData(modelKey, metricKey, allMetrics[metricKey]));
        }
    }

    await Promise.all(promises);
    updateVisualizations();
}

async function loadModelData(modelKey, metricKey, metric) {
    const model = CONFIG.models[modelKey];

    let filePath;

    if (modelKey === 'fixed') {
        const fixedVersion = FIXED_VERSION_MAP[state.modelVersion];
        const folder = fixedVersion === '1000' ? 'fixed_time_baseline_1000' : 'fixed_time_baseline_2000_rev';
        filePath = `${CONFIG.basePath}/${model.path}/${folder}/${metric.file}`;
    } else {
        const folder = `model_${state.modelVersion}`;
        if (state.dataType === 'testing') {
            filePath = `${CONFIG.basePath}/${model.path}/${folder}/test/${metric.file}`;
        } else {
            filePath = `${CONFIG.basePath}/${model.path}/${folder}/${metric.file}`;
        }
    }

    try {
        const response = await fetch(filePath);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const text = await response.text();
        const values = text.split('\n')
            .map(line => line.trim())
            .filter(line => line !== '')
            .map(parseFloat)
            .filter(val => !isNaN(val));

        if (!state.data[modelKey]) state.data[modelKey] = {};
        state.data[modelKey][metricKey] = values;

    } catch (error) {
        console.warn(`Could not load ${filePath}:`, error.message);
        if (!state.data[modelKey]) state.data[modelKey] = {};
        state.data[modelKey][metricKey] = [];
    }
}

function showLoading() {
    document.getElementById('stats-grid').innerHTML = '<div class="loading">Loading data</div>';
}

// ===== Visualization Updates =====
function updateVisualizations() {
    updateContextBanner();
    updateStatsCards();
    updateTimeSeriesChart();
    updateComparisonChart();
    updateSummaryTable();
    updateAnalysis();
    updateChartLabel();
    updateKeyFindings();

    // Show/hide analysis section based on data type
    const analysisSection = document.getElementById('analysis-section');
    if (state.dataType === 'training') {
        analysisSection.style.display = 'none';
    } else {
        analysisSection.style.display = 'block';
    }
}

function updateContextBanner() {
    const banner = document.getElementById('context-banner');
    const scenario = state.modelVersion === '10' ? 'Off-Peak Hours' : 'Peak Hours';

    if (state.dataType === 'training') {
        banner.innerHTML = `
            <div class="banner-content training-banner">
                <span class="banner-icon">📊</span>
                <span class="banner-text">
                    <strong>Training Data — DQN Model</strong> 
                    Showing DQN learning progress during ${scenario.toLowerCase()} traffic scenario. 
                    Track how the agent improves over training episodes.
                </span>
            </div>
        `;
    } else {
        banner.innerHTML = `
            <div class="banner-content testing-banner">
                <span class="banner-icon">⚖️</span>
                <span class="banner-text">
                    <strong>Testing Data — DQN vs Fixed-Time</strong> 
                    Side-by-side comparison of DQN and Fixed-Time performance during ${scenario.toLowerCase()} testing.
                </span>
            </div>
        `;
    }
}

function updateChartLabel() {
    const metric = getActiveMetrics()[state.metric];
    if (!metric) return;

    const chartTitle = document.getElementById('chart-title');
    const chartLabel = document.getElementById('chart-metric-label');
    const barTitle = document.getElementById('bar-chart-title');
    const barSub = document.getElementById('bar-chart-subtitle');

    if (state.dataType === 'training') {
        chartTitle.textContent = 'DQN Training Progress';
        chartLabel.textContent = `${metric.name} over Episodes`;
        barTitle.textContent = 'Episode Statistics';
        barSub.textContent = 'Min / Avg / Max values';
    } else {
        chartTitle.textContent = 'DQN vs Fixed-Time';
        chartLabel.textContent = `${metric.name} over Simulation Steps`;
        barTitle.textContent = 'Average Comparison';
        barSub.textContent = `${metric.name} by Model`;
    }
}

// ===== Stats Cards =====
function updateStatsCards() {
    const statsGrid = document.getElementById('stats-grid');
    const metrics = getActiveMetrics();
    const metric = metrics[state.metric];
    if (!metric) { statsGrid.innerHTML = '<div class="loading">No data available</div>'; return; }

    const activeModels = getActiveModels();
    let cardsHtml = '';

    const fixedData = state.data.fixed?.[state.metric] || [];
    const fixedAvg = fixedData.length > 0 ? average(fixedData) : 0;

    for (const modelKey of activeModels) {
        const model = CONFIG.models[modelKey];
        const data = state.data[modelKey]?.[state.metric] || [];

        if (data.length === 0) continue;

        const avg = average(data);
        const min = Math.min(...data);
        const max = Math.max(...data);
        const std = standardDeviation(data);
        const median = getMedian(data);

        // Calculate improvement vs Fixed-Time (only in testing mode)
        let improvementHtml = '';
        if (state.dataType === 'testing' && modelKey !== 'fixed' && fixedAvg !== 0) {
            let improvement;
            if (metric.lowerIsBetter) {
                improvement = ((fixedAvg - avg) / fixedAvg) * 100;
            } else {
                improvement = ((avg - fixedAvg) / Math.abs(fixedAvg)) * 100;
            }

            const cls = improvement > 0 ? 'positive' : improvement < 0 ? 'negative' : 'neutral';
            const text = improvement > 0
                ? `↑ ${improvement.toFixed(1)}% better than Fixed-Time`
                : `↓ ${Math.abs(improvement).toFixed(1)}% worse than Fixed-Time`;
            improvementHtml = `<div class="stat-improvement ${cls}">${text}</div>`;
        } else if (state.dataType === 'testing' && modelKey === 'fixed') {
            improvementHtml = `<div class="stat-improvement neutral">Baseline</div>`;
        } else if (state.dataType === 'training') {
            // Show data point count for training
            improvementHtml = `<div class="stat-improvement neutral">${data.length} episodes</div>`;
        }

        cardsHtml += `
            <div class="stat-card" style="--card-accent: ${model.color}">
                <div class="stat-card-header">
                    <span class="stat-model-name">${model.name}</span>
                    <span class="stat-model-badge ${modelKey}">${state.dataType === 'training' ? 'TRAINING' : modelKey.toUpperCase()}</span>
                </div>
                <div class="stat-value">${formatNumber(avg)}</div>
                <div class="stat-label">Average ${metric.name} ${metric.unit ? `(${metric.unit})` : ''}</div>
                <div class="stat-details">
                    <div class="stat-detail">
                        <div class="stat-detail-value">${formatNumber(min)}</div>
                        <div class="stat-detail-label">Min</div>
                    </div>
                    <div class="stat-detail">
                        <div class="stat-detail-value">${formatNumber(median)}</div>
                        <div class="stat-detail-label">Median</div>
                    </div>
                    <div class="stat-detail">
                        <div class="stat-detail-value">${formatNumber(max)}</div>
                        <div class="stat-detail-label">Max</div>
                    </div>
                    <div class="stat-detail">
                        <div class="stat-detail-value">${formatNumber(std)}</div>
                        <div class="stat-detail-label">Std Dev</div>
                    </div>
                </div>
                ${improvementHtml}
            </div>
        `;
    }

    statsGrid.innerHTML = cardsHtml || '<div class="loading">No data available</div>';
}

// ===== Time Series Chart =====
function updateTimeSeriesChart() {
    const ctx = document.getElementById('time-series-chart').getContext('2d');
    const metrics = getActiveMetrics();
    const metric = metrics[state.metric];
    if (!metric) return;

    const activeModels = getActiveModels();
    const datasets = [];

    for (const modelKey of activeModels) {
        const model = CONFIG.models[modelKey];
        const data = state.data[modelKey]?.[state.metric] || [];

        if (data.length === 0) continue;

        // Downsample if too many points
        const sampledData = downsample(data, 500);

        datasets.push({
            label: model.name,
            data: sampledData,
            borderColor: model.color,
            backgroundColor: model.color + '15',
            borderWidth: 2,
            fill: state.dataType === 'training',
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 4
        });
    }

    if (timeSeriesChart) {
        timeSeriesChart.destroy();
    }

    const xLabel = state.dataType === 'training' ? 'Episode' : 'Simulation Step';

    timeSeriesChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: datasets[0]?.data.map((_, i) => i + 1) || [],
            datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    display: activeModels.length > 1,
                    position: 'top',
                    labels: {
                        color: '#555',
                        usePointStyle: true,
                        padding: 20,
                        font: { size: 12 }
                    }
                },
                tooltip: {
                    backgroundColor: '#fff',
                    titleColor: '#333',
                    bodyColor: '#555',
                    borderColor: '#ddd',
                    borderWidth: 1,
                    padding: 10,
                    displayColors: true
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: xLabel,
                        color: '#888'
                    },
                    grid: { color: 'rgba(0, 0, 0, 0.04)' },
                    ticks: { color: '#888', maxTicksLimit: 10 }
                },
                y: {
                    title: {
                        display: true,
                        text: `${metric.name}${metric.unit ? ` (${metric.unit})` : ''}`,
                        color: '#888'
                    },
                    grid: { color: 'rgba(0, 0, 0, 0.04)' },
                    ticks: { color: '#888' }
                }
            }
        }
    });
}

// ===== Comparison / Stats Bar Chart =====
function updateComparisonChart() {
    const ctx = document.getElementById('comparison-chart').getContext('2d');
    const metrics = getActiveMetrics();
    const metric = metrics[state.metric];
    if (!metric) return;

    const activeModels = getActiveModels();

    if (comparisonChart) {
        comparisonChart.destroy();
    }

    if (state.dataType === 'training') {
        // For training: show min/avg/max bar chart for DQN
        const data = state.data.dqn?.[state.metric] || [];
        if (data.length === 0) return;

        const avg = average(data);
        const min = Math.min(...data);
        const max = Math.max(...data);

        comparisonChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Min', 'Average', 'Max'],
                datasets: [{
                    label: metric.name,
                    data: [min, avg, max],
                    backgroundColor: ['#2e6b8a55', '#2e6b8aaa', '#2e6b8a55'],
                    borderColor: ['#2e6b8a', '#2e6b8a', '#2e6b8a'],
                    borderWidth: 1.5,
                    borderRadius: 4
                }]
            },
            options: getBarChartOptions(metric)
        });
    } else {
        // For testing: side-by-side model comparison
        const labels = [];
        const values = [];
        const colors = [];

        for (const modelKey of activeModels) {
            const model = CONFIG.models[modelKey];
            const data = state.data[modelKey]?.[state.metric] || [];
            if (data.length === 0) continue;

            labels.push(model.name);
            values.push(average(data));
            colors.push(model.color);
        }

        comparisonChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: `Average ${metric.name}`,
                    data: values,
                    backgroundColor: colors.map(c => c + 'aa'),
                    borderColor: colors,
                    borderWidth: 1.5,
                    borderRadius: 4
                }]
            },
            options: getBarChartOptions(metric)
        });
    }
}

function getBarChartOptions(metric) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: '#fff',
                titleColor: '#333',
                bodyColor: '#555',
                borderColor: '#ddd',
                borderWidth: 1,
                padding: 10
            }
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: { color: '#555' }
            },
            y: {
                title: {
                    display: true,
                    text: `${metric.name}${metric.unit ? ` (${metric.unit})` : ''}`,
                    color: '#888'
                },
                grid: { color: 'rgba(0, 0, 0, 0.04)' },
                ticks: { color: '#888' }
            }
        }
    };
}

// ===== Summary Table =====
function updateSummaryTable() {
    const tableContainer = document.getElementById('summary-table');
    const metrics = getActiveMetrics();
    const metric = metrics[state.metric];
    if (!metric) { tableContainer.innerHTML = ''; return; }

    const activeModels = getActiveModels();
    let rows = '';

    for (const modelKey of activeModels) {
        const model = CONFIG.models[modelKey];
        const data = state.data[modelKey]?.[state.metric] || [];
        if (data.length === 0) continue;

        const avg = average(data);
        const min = Math.min(...data);
        const max = Math.max(...data);
        const std = standardDeviation(data);
        const median = getMedian(data);

        // Build interpretation
        const interpretation = getStatInterpretation(model.name, metric, avg, median, std, min, max);

        rows += `
            <tr>
                <td><span class="table-model-dot" style="background: ${model.color}"></span>${model.name}</td>
                <td>${formatNumber(avg)}</td>
                <td>${formatNumber(median)}</td>
                <td>${formatNumber(min)}</td>
                <td>${formatNumber(max)}</td>
                <td>${formatNumber(std)}</td>
            </tr>
            <tr class="interpretation-row">
                <td colspan="6">${interpretation}</td>
            </tr>
        `;
    }

    tableContainer.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Model</th>
                    <th>Mean</th>
                    <th>Median</th>
                    <th>Min</th>
                    <th>Max</th>
                    <th>Std Dev</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;
}

function getStatInterpretation(modelName, metric, mean, median, std, min, max) {
    const parts = [];
    const unitStr = metric.unit ? ` ${metric.unit}` : '';

    // Mean vs Median relationship
    const skewRatio = mean / median;
    if (median === 0 && mean === 0) {
        parts.push(`Both mean and median are zero, indicating no measurable ${metric.name.toLowerCase()} in most cases.`);
    } else if (median === 0) {
        parts.push(`The median is 0 while the mean is ${formatNumber(mean)}${unitStr}, indicating that most data points have zero ${metric.name.toLowerCase()} but occasional spikes raise the average.`);
    } else if (skewRatio > 1.15) {
        parts.push(`The mean (${formatNumber(mean)}) is higher than the median (${formatNumber(median)}), suggesting the data is right-skewed — a few high values pull the average up.`);
    } else if (skewRatio < 0.85) {
        parts.push(`The mean (${formatNumber(mean)}) is lower than the median (${formatNumber(median)}), suggesting the data is left-skewed — occasional low values pull the average down.`);
    } else {
        parts.push(`The mean (${formatNumber(mean)}) and median (${formatNumber(median)}) are close, indicating a roughly symmetric distribution.`);
    }

    // Variability
    const cv = mean !== 0 ? (std / Math.abs(mean)) * 100 : 0;
    if (cv < 20) {
        parts.push(`Low variability (CV: ${cv.toFixed(0)}%) shows consistent, stable performance.`);
    } else if (cv < 50) {
        parts.push(`Moderate variability (CV: ${cv.toFixed(0)}%) indicates some fluctuation in performance.`);
    } else {
        parts.push(`High variability (CV: ${cv.toFixed(0)}%) reflects significant performance swings across data points.`);
    }

    return parts.join(' ');
}

// ===== Analysis Section (testing only) =====
function updateAnalysis() {
    const analysisContent = document.getElementById('analysis-content');
    if (state.dataType === 'training') {
        analysisContent.innerHTML = '';
        return;
    }

    const metrics = getActiveMetrics();
    const metric = metrics[state.metric];
    if (!metric) return;

    let bestModel = null;
    let bestValue = metric.lowerIsBetter ? Infinity : -Infinity;
    const modelStats = [];

    for (const modelKey of getActiveModels()) {
        const data = state.data[modelKey]?.[state.metric] || [];
        if (data.length === 0) continue;

        const avg = average(data);
        const model = CONFIG.models[modelKey];
        modelStats.push({ key: modelKey, name: model.name, avg, color: model.color });

        if (metric.lowerIsBetter ? avg < bestValue : avg > bestValue) {
            bestValue = avg;
            bestModel = model.name;
        }
    }

    const fixedStats = modelStats.find(m => m.key === 'fixed');
    const dqnStats = modelStats.find(m => m.key === 'dqn');

    let analysisHtml = `
        <div class="analysis-item">
            <div class="analysis-item-title">Best Performer</div>
            <div class="analysis-item-value winner">${bestModel || 'N/A'}</div>
        </div>
        <div class="analysis-item">
            <div class="analysis-item-title">Best Value</div>
            <div class="analysis-item-value">${formatNumber(bestValue)} ${metric.unit}</div>
        </div>
    `;

    if (fixedStats && dqnStats) {
        let improvement;
        if (metric.lowerIsBetter) {
            improvement = ((fixedStats.avg - dqnStats.avg) / fixedStats.avg) * 100;
        } else {
            improvement = ((dqnStats.avg - fixedStats.avg) / Math.abs(fixedStats.avg)) * 100;
        }

        const sign = improvement >= 0 ? '+' : '';
        const cls = improvement > 0 ? 'winner' : '';

        analysisHtml += `
            <div class="analysis-item">
                <div class="analysis-item-title">DQN vs Fixed-Time</div>
                <div class="analysis-item-value ${cls}">${sign}${improvement.toFixed(1)}%</div>
            </div>
        `;

        // Add absolute difference
        const diff = Math.abs(dqnStats.avg - fixedStats.avg);
        analysisHtml += `
            <div class="analysis-item">
                <div class="analysis-item-title">Absolute Difference</div>
                <div class="analysis-item-value">${formatNumber(diff)} ${metric.unit}</div>
            </div>
        `;
    }

    analysisContent.innerHTML = analysisHtml;
}



// ===== Utility Functions =====
function average(arr) {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function standardDeviation(arr) {
    if (arr.length === 0) return 0;
    const avg = average(arr);
    const squareDiffs = arr.map(value => Math.pow(value - avg, 2));
    return Math.sqrt(average(squareDiffs));
}

function getMedian(arr) {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function getPercentile(arr, p) {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return sorted[lower];
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function formatNumber(num) {
    if (num === Infinity || num === -Infinity || isNaN(num)) return 'N/A';
    if (Math.abs(num) >= 1000000) {
        return (num / 1000000).toFixed(2) + 'M';
    }
    if (Math.abs(num) >= 1000) {
        return (num / 1000).toFixed(2) + 'K';
    }
    return num.toFixed(2);
}

function downsample(data, maxPoints) {
    if (data.length <= maxPoints) return data;

    const step = Math.ceil(data.length / maxPoints);
    const result = [];

    for (let i = 0; i < data.length; i += step) {
        const chunk = data.slice(i, Math.min(i + step, data.length));
        result.push(average(chunk));
    }

    return result;
}

// ===== Key Findings Generator =====
function updateKeyFindings() {
    const findingsContent = document.getElementById('findings-content');
    const metrics = getActiveMetrics();
    const metric = metrics[state.metric];
    if (!metric) { findingsContent.innerHTML = ''; return; }

    const dataType = state.dataType === 'training' ? 'Training' : 'Testing';
    const activeModels = getActiveModels();
    const findings = [];
    const modelStats = [];

    for (const modelKey of activeModels) {
        const model = CONFIG.models[modelKey];
        const data = state.data[modelKey]?.[state.metric] || [];
        if (data.length === 0) continue;

        modelStats.push({
            key: modelKey,
            name: model.name,
            avg: average(data),
            min: Math.min(...data),
            max: Math.max(...data),
            std: standardDeviation(data),
            median: getMedian(data),
            dataPoints: data.length
        });
    }

    if (modelStats.length === 0) {
        findingsContent.innerHTML = '<div class="finding-item"><span class="finding-text">Loading data...</span></div>';
        return;
    }

    if (state.dataType === 'training') {
        // Training findings: focus on DQN learning
        const dqn = modelStats.find(m => m.key === 'dqn');
        if (dqn) {
            const data = state.data.dqn?.[state.metric] || [];
            const firstQuarter = data.slice(0, Math.floor(data.length / 4));
            const lastQuarter = data.slice(-Math.floor(data.length / 4));
            const earlyAvg = average(firstQuarter);
            const lateAvg = average(lastQuarter);

            let progressText;
            if (metric.lowerIsBetter) {
                const improvement = ((earlyAvg - lateAvg) / earlyAvg) * 100;
                progressText = improvement > 0
                    ? `The DQN agent improved by <strong>${improvement.toFixed(1)}%</strong> from the first quarter to the last quarter of training, showing effective learning.`
                    : `The agent's ${metric.name.toLowerCase()} increased by ${Math.abs(improvement).toFixed(1)}% over training, which may indicate exploration or environment changes.`;
            } else {
                const improvement = ((lateAvg - earlyAvg) / Math.abs(earlyAvg)) * 100;
                progressText = improvement > 0
                    ? `The DQN agent's ${metric.name.toLowerCase()} improved by <strong>${improvement.toFixed(1)}%</strong> from early to late training.`
                    : `The agent's ${metric.name.toLowerCase()} decreased by ${Math.abs(improvement).toFixed(1)}% over training.`;
            }

            findings.push({ text: progressText, type: 'highlight' });

            findings.push({
                text: `Over <strong>${dqn.dataPoints} episodes</strong>, the DQN agent achieved a mean ${metric.name.toLowerCase()} of <strong>${formatNumber(dqn.avg)} ${metric.unit}</strong> (median: ${formatNumber(dqn.median)}).`,
                type: 'normal'
            });

            findings.push({
                text: `Performance ranged from ${formatNumber(dqn.min)} to ${formatNumber(dqn.max)}, with a standard deviation of ${formatNumber(dqn.std)}, indicating ${dqn.std / dqn.avg < 0.3 ? 'relatively stable' : 'variable'} learning behavior.`,
                type: 'normal'
            });
        }
    } else {
        // Testing findings: DQN vs Fixed-Time comparison
        const sortedByAvg = [...modelStats].sort((a, b) =>
            metric.lowerIsBetter ? a.avg - b.avg : b.avg - a.avg
        );
        const bestModel = sortedByAvg[0];

        findings.push({
            text: `<strong>${bestModel.name}</strong> achieves the best ${metric.name.toLowerCase()} during testing with an average of <strong>${formatNumber(bestModel.avg)} ${metric.unit}</strong>.`,
            type: 'highlight'
        });

        const fixedStats = modelStats.find(m => m.key === 'fixed');
        const dqnStats = modelStats.find(m => m.key === 'dqn');

        if (fixedStats && dqnStats) {
            const improvement = metric.lowerIsBetter
                ? ((fixedStats.avg - dqnStats.avg) / fixedStats.avg) * 100
                : ((dqnStats.avg - fixedStats.avg) / Math.abs(fixedStats.avg)) * 100;

            if (improvement > 0) {
                findings.push({
                    text: `<strong>DQN outperforms Fixed-Time</strong> by ${Math.abs(improvement).toFixed(1)}% in ${metric.name.toLowerCase()}, showing that reinforcement learning can improve traffic signal control over traditional fixed-timing approaches.`,
                    type: 'highlight'
                });
            } else {
                findings.push({
                    text: `Fixed-Time baseline shows ${Math.abs(improvement).toFixed(1)}% better ${metric.name.toLowerCase()} than DQN in this scenario.`,
                    type: 'warning'
                });
            }
        }

        // Stability comparison
        const mostStable = [...modelStats].sort((a, b) => a.std - b.std)[0];
        findings.push({
            text: `<strong>${mostStable.name}</strong> shows the most consistent performance (σ = ${formatNumber(mostStable.std)}), indicating more predictable behavior.`,
            type: 'normal'
        });
    }

    let html = '';
    findings.forEach((finding, index) => {
        html += `
            <div class="finding-item ${finding.type}">
                <span class="finding-number">${index + 1}</span>
                <span class="finding-text">${finding.text}</span>
            </div>
        `;
    });

    findingsContent.innerHTML = html;
}
