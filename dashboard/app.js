// ===== Configuration =====
const CONFIG = {
    basePath: '..',
    models: {
        dqn: { name: 'DQN', color: '#00c2a8', path: 'models_dqn' },
        fixed: { name: 'Fixed-Time', color: '#f0a500', path: 'models_fixed' }
    },
    trainingMetrics: {
        reward: { name: 'Cumulative Reward', file: 'plot_reward_data.txt', unit: '', lowerIsBetter: false }
    },
    testingMetrics: {
        queue: { name: 'Queue Length', file: 'plot_queue_data.txt', unit: 'vehicles', lowerIsBetter: true },
        waiting: { name: 'Avg Waiting Time', file: 'plot_avg_waiting_time_data.txt', unit: 'seconds', lowerIsBetter: true }
    }
};

const FIXED_VERSION_MAP = {
    '10': '1000',
    '16': '2000_rev'
};

const THEME_STORAGE_KEY = 'traffic_dashboard_theme';

// ===== State =====
let state = {
    modelVersion: '10',
    dataType: 'training',
    metric: 'queue',
    smoothingWindow: 1,
    data: {},
    cache: {}          // cache[cacheKey] = values[]
};

let timeSeriesChart = null;
let comparisonChart = null;

// ===== Chart.js dark theme defaults =====
Chart.defaults.color = '#5a6070';
Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';
Chart.defaults.font.family = "'DM Mono', monospace";

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
    applyInitialTheme();
    initializeControls();
    populateMetricOptions();
    loadAllData();
});

function initializeControls() {
    document.getElementById('model-version').addEventListener('change', (e) => {
        state.modelVersion = e.target.value;
        loadAllData();
    });

    document.querySelectorAll('#data-type-toggle .toggle-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('#data-type-toggle .toggle-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            state.dataType = e.target.dataset.value;
            populateMetricOptions();
            loadAllData();
        });
    });

    document.getElementById('metric-select').addEventListener('change', (e) => {
        state.metric = e.target.value;
        updateVisualizations();
    });

    document.getElementById('smoothing-select').addEventListener('change', (e) => {
        state.smoothingWindow = parseInt(e.target.value, 10) || 1;
        updateVisualizations();
    });

    document.getElementById('download-csv-btn').addEventListener('click', downloadCurrentCsv);
    document.getElementById('theme-toggle-btn').addEventListener('click', toggleTheme);
}

function applyInitialTheme() {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = savedTheme || (prefersDark ? 'dark' : 'light');
    setTheme(theme);
}

function toggleTheme() {
    const isLight = document.body.classList.contains('light-theme');
    setTheme(isLight ? 'dark' : 'light');
}

function setTheme(theme) {
    const isLight = theme === 'light';
    document.body.classList.toggle('light-theme', isLight);
    localStorage.setItem(THEME_STORAGE_KEY, isLight ? 'light' : 'dark');

    const button = document.getElementById('theme-toggle-btn');
    const label = document.getElementById('theme-toggle-label');
    if (button) {
        if (label) {
            label.textContent = isLight ? 'Dark Mode' : 'Light Mode';
        }
        button.setAttribute('aria-label', isLight ? 'Switch to dark mode' : 'Switch to light mode');
    }

    applyChartTheme();
    refreshChartsForTheme();
}

function applyChartTheme() {
    const style = getComputedStyle(document.body);
    Chart.defaults.color = style.getPropertyValue('--text-muted').trim() || '#5a6070';
    Chart.defaults.borderColor = style.getPropertyValue('--border-dim').trim() || 'rgba(255,255,255,0.06)';
}

function refreshChartsForTheme() {
    if (Object.keys(state.data).length > 0) {
        updateTimeSeriesChart();
        updateComparisonChart();
    }
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
    if (!metrics[state.metric]) {
        state.metric = Object.keys(metrics)[0];
    }
    select.value = state.metric;
}

function getActiveMetrics() {
    return state.dataType === 'training' ? CONFIG.trainingMetrics : CONFIG.testingMetrics;
}

function getActiveModels() {
    return state.dataType === 'training' ? ['dqn'] : ['dqn', 'fixed'];
}

// ===== Data Loading (with caching) =====
async function loadAllData() {
    showLoading();
    const allMetrics = { ...CONFIG.trainingMetrics, ...CONFIG.testingMetrics };
    const promises = [];

    for (const modelKey of Object.keys(CONFIG.models)) {
        for (const metricKey of Object.keys(allMetrics)) {
            promises.push(loadModelData(modelKey, metricKey, allMetrics[metricKey]));
        }
    }

    await Promise.all(promises);
    updateVisualizations();
}

function buildFilePath(modelKey, metricKey, metric) {
    const model = CONFIG.models[modelKey];
    if (modelKey === 'fixed') {
        const fixedVersion = FIXED_VERSION_MAP[state.modelVersion];
        const folder = fixedVersion === '1000' ? 'fixed_time_baseline_1000' : 'fixed_time_baseline_2000_rev';
        return `${CONFIG.basePath}/${model.path}/${folder}/${metric.file}`;
    }
    const folder = `model_${state.modelVersion}`;
    if (state.dataType === 'testing') {
        return `${CONFIG.basePath}/${model.path}/${folder}/test/${metric.file}`;
    }
    return `${CONFIG.basePath}/${model.path}/${folder}/${metric.file}`;
}

async function loadModelData(modelKey, metricKey, metric) {
    const filePath = buildFilePath(modelKey, metricKey, metric);
    const cacheKey = filePath;

    // Return cached result if available
    if (state.cache[cacheKey] !== undefined) {
        if (!state.data[modelKey]) state.data[modelKey] = {};
        state.data[modelKey][metricKey] = state.cache[cacheKey];
        return;
    }

    try {
        const response = await fetch(filePath);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const text = await response.text();
        const values = text.split('\n')
            .map(l => l.trim())
            .filter(l => l !== '')
            .map(parseFloat)
            .filter(v => !isNaN(v));

        state.cache[cacheKey] = values;
        if (!state.data[modelKey]) state.data[modelKey] = {};
        state.data[modelKey][metricKey] = values;

    } catch {
        state.cache[cacheKey] = [];
        if (!state.data[modelKey]) state.data[modelKey] = {};
        state.data[modelKey][metricKey] = [];
    }
}

function showLoading() {
    document.getElementById('stats-grid').innerHTML = '<div class="loading">Loading data</div>';
}

// ===== Visualizations =====
function updateVisualizations() {
    updateContextBanner();
    updateOverviewStrip();
    updateStatsCards();
    updateTimeSeriesChart();
    updateComparisonChart();
    updateSummaryTable();
    updateAnalysis();
    updateChartLabel();
    updateKeyFindings();

    const analysisSection = document.getElementById('analysis-section');
    analysisSection.style.display = state.dataType === 'training' ? 'none' : 'block';
}

function updateContextBanner() {
    const banner = document.getElementById('context-banner');
    const scenario = state.modelVersion === '10' ? 'Off-Peak Hours' : 'Peak Hours';

    if (state.dataType === 'training') {
        banner.innerHTML = `
            <div class="banner-content training-banner">
                <span class="banner-icon">📈</span>
                <span class="banner-text">
                    <strong>Training Mode — DQN Agent</strong>
                    Tracking learning progress during ${scenario.toLowerCase()} traffic scenario.
                </span>
            </div>`;
    } else {
        banner.innerHTML = `
            <div class="banner-content testing-banner">
                <span class="banner-icon">⚖️</span>
                <span class="banner-text">
                    <strong>Testing Mode — DQN vs Fixed-Time</strong>
                    Side-by-side evaluation during ${scenario.toLowerCase()} simulation.
                </span>
            </div>`;
    }
}

function updateChartLabel() {
    const metric = getActiveMetrics()[state.metric];
    if (!metric) return;

    const smoothingText = state.smoothingWindow > 1
        ? ` · Smoothed (${state.smoothingWindow}-point MA)`
        : '';

    if (state.dataType === 'training') {
        document.getElementById('chart-title').textContent = 'DQN Training Progress';
        document.getElementById('chart-metric-label').textContent = `${metric.name} over Episodes${smoothingText}`;
        document.getElementById('bar-chart-title').textContent = 'Episode Statistics';
        document.getElementById('bar-chart-subtitle').textContent = 'Min / Avg / Max values';
    } else {
        document.getElementById('chart-title').textContent = 'DQN vs Fixed-Time';
        document.getElementById('chart-metric-label').textContent = `${metric.name} over Simulation Steps${smoothingText}`;
        document.getElementById('bar-chart-title').textContent = 'Average Comparison';
        document.getElementById('bar-chart-subtitle').textContent = `${metric.name} by Model`;
    }
}

function updateOverviewStrip() {
    const strip = document.getElementById('overview-strip');
    const metric = getActiveMetrics()[state.metric];
    if (!metric) {
        strip.innerHTML = '';
        return;
    }

    const dqnData = state.data.dqn?.[state.metric] || [];
    const fixedData = state.data.fixed?.[state.metric] || [];
    const scenario = state.modelVersion === '10' ? 'Off-Peak' : 'Peak';
    const smoothLabel = state.smoothingWindow > 1 ? `${state.smoothingWindow}-point MA` : 'Raw';

    const cards = [];
    cards.push(`
        <article class="overview-card">
            <span class="overview-label">Scenario</span>
            <span class="overview-value">${scenario} · ${state.dataType === 'training' ? 'Training' : 'Testing'}</span>
            <span class="overview-sub">View: ${smoothLabel}</span>
        </article>`);

    if (dqnData.length > 1) {
        const trend = dqnData[dqnData.length - 1] - dqnData[0];
        const trendUp = trend >= 0;
        cards.push(`
            <article class="overview-card ${trendUp ? 'positive' : 'warning'}">
                <span class="overview-label">DQN Trend</span>
                <span class="overview-value">${trendUp ? 'Upward' : 'Downward'} ${Math.abs((trend / (Math.abs(dqnData[0]) || 1)) * 100).toFixed(1)}%</span>
                <span class="overview-sub">From first to latest data point</span>
            </article>`);
    }

    if (state.dataType === 'testing' && dqnData.length > 0 && fixedData.length > 0) {
        const dqnAvg = average(dqnData);
        const fixedAvg = average(fixedData);
        const delta = metric.lowerIsBetter
            ? ((fixedAvg - dqnAvg) / (Math.abs(fixedAvg) || 1)) * 100
            : ((dqnAvg - fixedAvg) / (Math.abs(fixedAvg) || 1)) * 100;
        cards.push(`
            <article class="overview-card ${delta >= 0 ? 'positive' : 'warning'}">
                <span class="overview-label">Relative Outcome</span>
                <span class="overview-value">${delta >= 0 ? '+' : ''}${delta.toFixed(1)}% vs Fixed-Time</span>
                <span class="overview-sub">Based on current ${metric.name.toLowerCase()}</span>
            </article>`);
    }

    const activeModels = getActiveModels();
    const points = activeModels.reduce((sum, key) => sum + (state.data[key]?.[state.metric]?.length || 0), 0);
    cards.push(`
        <article class="overview-card">
            <span class="overview-label">Data Coverage</span>
            <span class="overview-value">${points} points</span>
            <span class="overview-sub">Across ${activeModels.length} model${activeModels.length > 1 ? 's' : ''}</span>
        </article>`);

    strip.innerHTML = `<div class="overview-grid">${cards.join('')}</div>`;
}

// ===== Stats Cards =====
function updateStatsCards() {
    const statsGrid = document.getElementById('stats-grid');
    const metrics = getActiveMetrics();
    const metric = metrics[state.metric];
    if (!metric) { statsGrid.innerHTML = '<div class="loading">No data</div>'; return; }

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
        const med = getMedian(data);

        let improvementHtml = '';
        if (state.dataType === 'testing' && modelKey !== 'fixed' && fixedAvg !== 0) {
            const improvement = metric.lowerIsBetter
                ? ((fixedAvg - avg) / fixedAvg) * 100
                : ((avg - fixedAvg) / Math.abs(fixedAvg)) * 100;
            const cls = improvement > 0 ? 'positive' : improvement < 0 ? 'negative' : 'neutral';
            const text = improvement > 0
                ? `↑ ${improvement.toFixed(1)}% better than Fixed-Time`
                : `↓ ${Math.abs(improvement).toFixed(1)}% worse than Fixed-Time`;
            improvementHtml = `<div class="stat-improvement ${cls}">${text}</div>`;
        } else if (state.dataType === 'testing' && modelKey === 'fixed') {
            improvementHtml = `<div class="stat-improvement neutral">Baseline</div>`;
        } else if (state.dataType === 'training') {
            improvementHtml = `<div class="stat-improvement neutral">${data.length} episodes recorded</div>`;
        }

        cardsHtml += `
            <div class="stat-card" style="--card-accent: ${model.color}">
                <div class="stat-card-header">
                    <span class="stat-model-name">${model.name}</span>
                    <span class="stat-model-badge ${modelKey}">${state.dataType === 'training' ? 'TRAINING' : modelKey.toUpperCase()}</span>
                </div>
                <div class="stat-value">${formatNumber(avg)}</div>
                <div class="stat-label">Average ${metric.name}${metric.unit ? ` · ${metric.unit}` : ''}</div>
                <div class="stat-details">
                    <div class="stat-detail">
                        <div class="stat-detail-value">${formatNumber(min)}</div>
                        <div class="stat-detail-label">Min</div>
                    </div>
                    <div class="stat-detail">
                        <div class="stat-detail-value">${formatNumber(med)}</div>
                        <div class="stat-detail-label">Median</div>
                    </div>
                    <div class="stat-detail">
                        <div class="stat-detail-value">${formatNumber(max)}</div>
                        <div class="stat-detail-label">Max</div>
                    </div>
                    <div class="stat-detail">
                        <div class="stat-detail-value">${formatNumber(std)}</div>
                        <div class="stat-detail-label">σ</div>
                    </div>
                </div>
                ${improvementHtml}
            </div>`;
    }

    statsGrid.innerHTML = cardsHtml || '<div class="loading">No data available</div>';
}

// ===== Chart helpers =====
const CHART_COLORS = {
    dqn: '#00c2a8',
    fixed: '#f0a500'
};

function darkChartOptions(metric, xLabel) {
    const style = getComputedStyle(document.body);
    const textPrimary = style.getPropertyValue('--text-primary').trim();
    const textSecondary = style.getPropertyValue('--text-secondary').trim();
    const textMuted = style.getPropertyValue('--text-muted').trim();
    const borderDim = style.getPropertyValue('--border-dim').trim();
    const bgElevated = style.getPropertyValue('--bg-elevated').trim();

    return {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        animation: { duration: 400, easing: 'easeOutQuart' },
        plugins: {
            legend: {
                display: false,
                labels: {
                    color: textSecondary,
                    usePointStyle: true,
                    padding: 20,
                    font: { size: 11, family: "'DM Mono', monospace" }
                }
            },
            tooltip: {
                backgroundColor: bgElevated,
                titleColor: textPrimary,
                bodyColor: textSecondary,
                borderColor: borderDim,
                borderWidth: 1,
                padding: 12,
                displayColors: true,
                titleFont: { family: "'Syne', sans-serif", size: 12, weight: '600' },
                bodyFont: { family: "'DM Mono', monospace", size: 11 }
            }
        },
        scales: {
            x: {
                title: { display: true, text: xLabel, color: textMuted, font: { size: 10, family: "'DM Mono', monospace" } },
                grid: { color: borderDim },
                ticks: { color: textMuted, maxTicksLimit: 10, font: { size: 10 } }
            },
            y: {
                title: {
                    display: true,
                    text: `${metric.name}${metric.unit ? ` (${metric.unit})` : ''}`,
                    color: textMuted,
                    font: { size: 10, family: "'DM Mono', monospace" }
                },
                grid: { color: borderDim },
                ticks: { color: textMuted, font: { size: 10 } }
            }
        }
    };
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
        const data = state.data[modelKey]?.[state.metric] || [];
        if (data.length === 0) continue;

        const color = CHART_COLORS[modelKey];
        const smoothed = movingAverage(data, state.smoothingWindow);
        const sampled = downsample(smoothed, 500);

        datasets.push({
            label: CONFIG.models[modelKey].name,
            data: sampled,
            borderColor: color,
            backgroundColor: color + '18',
            borderWidth: 1.5,
            fill: state.dataType === 'training',
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: color,
            pointHoverBorderColor: '#0e0f11',
            pointHoverBorderWidth: 2
        });
    }

    if (timeSeriesChart) timeSeriesChart.destroy();

    const xLabel = state.dataType === 'training' ? 'Episode' : 'Simulation Step';
    const options = darkChartOptions(metric, xLabel);

    // Show legend only for multi-model
    options.plugins.legend.display = activeModels.length > 1;

    timeSeriesChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: datasets[0]?.data.map((_, i) => i + 1) || [],
            datasets
        },
        options
    });
}

// ===== Comparison Bar Chart =====
function updateComparisonChart() {
    const ctx = document.getElementById('comparison-chart').getContext('2d');
    const metrics = getActiveMetrics();
    const metric = metrics[state.metric];
    if (!metric) return;

    if (comparisonChart) comparisonChart.destroy();

    const baseOptions = darkChartOptions(metric, '');
    delete baseOptions.scales.x.title;
    baseOptions.scales.x.grid = { display: false };
    baseOptions.scales.x.ticks.font = { size: 11, family: "'Syne', sans-serif", weight: '600' };
    baseOptions.scales.x.ticks.color = getComputedStyle(document.body).getPropertyValue('--text-secondary').trim();

    if (state.dataType === 'training') {
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
                    backgroundColor: ['#00c2a820', '#00c2a855', '#00c2a820'],
                    borderColor: ['#00c2a860', '#00c2a8', '#00c2a860'],
                    borderWidth: 1,
                    borderRadius: 3
                }]
            },
            options: baseOptions
        });
    } else {
        const labels = [], values = [], colors = [], borderColors = [];
        for (const modelKey of getActiveModels()) {
            const data = state.data[modelKey]?.[state.metric] || [];
            if (data.length === 0) continue;
            const color = CHART_COLORS[modelKey];
            labels.push(CONFIG.models[modelKey].name);
            values.push(average(data));
            colors.push(color + '55');
            borderColors.push(color);
        }

        comparisonChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: `Avg ${metric.name}`,
                    data: values,
                    backgroundColor: colors,
                    borderColor: borderColors,
                    borderWidth: 1.5,
                    borderRadius: 4
                }]
            },
            options: baseOptions
        });
    }
}

// ===== Summary Table =====
function updateSummaryTable() {
    const tableContainer = document.getElementById('summary-table');
    const metrics = getActiveMetrics();
    const metric = metrics[state.metric];
    if (!metric) { tableContainer.innerHTML = ''; return; }

    let rows = '';
    for (const modelKey of getActiveModels()) {
        const model = CONFIG.models[modelKey];
        const data = state.data[modelKey]?.[state.metric] || [];
        if (data.length === 0) continue;

        const avg = average(data);
        const med = getMedian(data);
        const min = Math.min(...data);
        const max = Math.max(...data);
        const std = standardDeviation(data);

        rows += `
            <tr>
                <td><span class="table-model-dot" style="background:${model.color};color:${model.color}"></span>${model.name}</td>
                <td>${formatNumber(avg)}</td>
                <td>${formatNumber(med)}</td>
                <td>${formatNumber(min)}</td>
                <td>${formatNumber(max)}</td>
                <td>${formatNumber(std)}</td>
            </tr>
            <tr class="interpretation-row">
                <td colspan="6">${getStatInterpretation(model.name, metric, avg, med, std, min, max)}</td>
            </tr>`;
    }

    tableContainer.innerHTML = `
        <table>
            <thead>
                <tr>
                    <th>Model</th><th>Mean</th><th>Median</th><th>Min</th><th>Max</th><th>Std Dev</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>`;
}

function getStatInterpretation(modelName, metric, mean, median, std, min, max) {
    const parts = [];
    const unitStr = metric.unit ? ` ${metric.unit}` : '';
    const skewRatio = mean / median;

    if (median === 0 && mean === 0) {
        parts.push(`Both mean and median are zero — no measurable ${metric.name.toLowerCase()} in most cases.`);
    } else if (median === 0) {
        parts.push(`Median is 0 while mean is ${formatNumber(mean)}${unitStr} — most data points are zero with occasional spikes.`);
    } else if (skewRatio > 1.15) {
        parts.push(`Mean (${formatNumber(mean)}) exceeds median (${formatNumber(median)}) — right-skewed distribution; a few high values pull the average up.`);
    } else if (skewRatio < 0.85) {
        parts.push(`Mean (${formatNumber(mean)}) is below median (${formatNumber(median)}) — left-skewed; occasional low values reduce the average.`);
    } else {
        parts.push(`Mean (${formatNumber(mean)}) and median (${formatNumber(median)}) are close — roughly symmetric distribution.`);
    }

    const cv = mean !== 0 ? (std / Math.abs(mean)) * 100 : 0;
    if (cv < 20) {
        parts.push(`Low variability (CV: ${cv.toFixed(0)}%) — consistent, stable performance.`);
    } else if (cv < 50) {
        parts.push(`Moderate variability (CV: ${cv.toFixed(0)}%) — some performance fluctuation.`);
    } else {
        parts.push(`High variability (CV: ${cv.toFixed(0)}%) — significant performance swings across data points.`);
    }

    return parts.join(' ');
}

// ===== Analysis Section =====
function updateAnalysis() {
    const analysisContent = document.getElementById('analysis-content');
    if (state.dataType === 'training') { analysisContent.innerHTML = ''; return; }

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

    let html = `
        <div class="analysis-item">
            <div class="analysis-item-title">Best Performer</div>
            <div class="analysis-item-value winner">${bestModel || 'N/A'}</div>
        </div>
        <div class="analysis-item">
            <div class="analysis-item-title">Best Value</div>
            <div class="analysis-item-value">${formatNumber(bestValue)} ${metric.unit}</div>
        </div>`;

    if (fixedStats && dqnStats) {
        const improvement = metric.lowerIsBetter
            ? ((fixedStats.avg - dqnStats.avg) / fixedStats.avg) * 100
            : ((dqnStats.avg - fixedStats.avg) / Math.abs(fixedStats.avg)) * 100;

        const sign = improvement >= 0 ? '+' : '';
        const cls = improvement > 0 ? 'winner' : '';
        const diff = Math.abs(dqnStats.avg - fixedStats.avg);

        html += `
            <div class="analysis-item">
                <div class="analysis-item-title">DQN vs Fixed-Time</div>
                <div class="analysis-item-value ${cls}">${sign}${improvement.toFixed(1)}%</div>
            </div>
            <div class="analysis-item">
                <div class="analysis-item-title">Absolute Δ</div>
                <div class="analysis-item-value">${formatNumber(diff)} ${metric.unit}</div>
            </div>`;
    }

    analysisContent.innerHTML = html;
}

// ===== Key Findings =====
function updateKeyFindings() {
    const findingsContent = document.getElementById('findings-content');
    const metrics = getActiveMetrics();
    const metric = metrics[state.metric];
    if (!metric) { findingsContent.innerHTML = ''; return; }

    const activeModels = getActiveModels();
    const findings = [];
    const modelStats = [];

    for (const modelKey of activeModels) {
        const model = CONFIG.models[modelKey];
        const data = state.data[modelKey]?.[state.metric] || [];
        if (data.length === 0) continue;
        modelStats.push({
            key: modelKey, name: model.name,
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
        const dqn = modelStats.find(m => m.key === 'dqn');
        if (dqn) {
            const data = state.data.dqn?.[state.metric] || [];
            const firstQ = data.slice(0, Math.floor(data.length / 4));
            const lastQ = data.slice(-Math.floor(data.length / 4));
            const earlyAvg = average(firstQ);
            const lateAvg = average(lastQ);

            let progressText;
            if (metric.lowerIsBetter) {
                const imp = ((earlyAvg - lateAvg) / earlyAvg) * 100;
                progressText = imp > 0
                    ? `DQN agent improved by <strong>${imp.toFixed(1)}%</strong> from the first to last training quarter.`
                    : `Agent's ${metric.name.toLowerCase()} rose by ${Math.abs(imp).toFixed(1)}% over training — may reflect exploration.`;
            } else {
                const imp = ((lateAvg - earlyAvg) / Math.abs(earlyAvg)) * 100;
                progressText = imp > 0
                    ? `DQN agent's ${metric.name.toLowerCase()} improved by <strong>${imp.toFixed(1)}%</strong> from early to late training.`
                    : `Agent's ${metric.name.toLowerCase()} decreased by ${Math.abs(imp).toFixed(1)}% over training.`;
            }

            findings.push({ text: progressText, type: 'highlight' });
            findings.push({
                text: `Over <strong>${dqn.dataPoints} episodes</strong>, mean ${metric.name.toLowerCase()} was <strong>${formatNumber(dqn.avg)} ${metric.unit}</strong> (median: ${formatNumber(dqn.median)}).`,
                type: 'normal'
            });
            findings.push({
                text: `Range: ${formatNumber(dqn.min)} – ${formatNumber(dqn.max)} · σ = ${formatNumber(dqn.std)} — ${dqn.std / dqn.avg < 0.3 ? 'stable' : 'variable'} learning behavior.`,
                type: 'normal'
            });
        }
    } else {
        const sorted = [...modelStats].sort((a, b) =>
            metric.lowerIsBetter ? a.avg - b.avg : b.avg - a.avg);
        const best = sorted[0];

        findings.push({
            text: `<strong>${best.name}</strong> achieves the best ${metric.name.toLowerCase()} with an average of <strong>${formatNumber(best.avg)} ${metric.unit}</strong>.`,
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
                    text: `<strong>DQN outperforms Fixed-Time</strong> by ${Math.abs(improvement).toFixed(1)}% on ${metric.name.toLowerCase()}, demonstrating the advantage of adaptive RL-based signal control.`,
                    type: 'highlight'
                });
            } else {
                findings.push({
                    text: `Fixed-Time baseline is ${Math.abs(improvement).toFixed(1)}% better on ${metric.name.toLowerCase()} in this scenario — DQN may need further tuning.`,
                    type: 'warning'
                });
            }
        }

        const mostStable = [...modelStats].sort((a, b) => a.std - b.std)[0];
        findings.push({
            text: `<strong>${mostStable.name}</strong> is most consistent (σ = ${formatNumber(mostStable.std)}) — more predictable behavior across simulation steps.`,
            type: 'normal'
        });
    }

    findingsContent.innerHTML = findings.map((f, i) => `
        <div class="finding-item ${f.type}">
            <span class="finding-number">${String(i + 1).padStart(2, '0')}</span>
            <span class="finding-text">${f.text}</span>
        </div>`).join('');
}

// ===== Utility =====
function average(arr) {
    if (!arr.length) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function standardDeviation(arr) {
    if (!arr.length) return 0;
    const avg = average(arr);
    return Math.sqrt(average(arr.map(v => Math.pow(v - avg, 2))));
}

function getMedian(arr) {
    if (!arr.length) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function formatNumber(num) {
    if (num === Infinity || num === -Infinity || isNaN(num)) return 'N/A';
    if (Math.abs(num) >= 1000000) return (num / 1000000).toFixed(2) + 'M';
    if (Math.abs(num) >= 1000) return (num / 1000).toFixed(2) + 'K';
    return num.toFixed(2);
}

function downsample(data, maxPoints) {
    if (data.length <= maxPoints) return data;
    const step = Math.ceil(data.length / maxPoints);
    const result = [];
    for (let i = 0; i < data.length; i += step) {
        result.push(average(data.slice(i, Math.min(i + step, data.length))));
    }
    return result;
}

function movingAverage(data, windowSize) {
    const size = Number(windowSize) || 1;
    if (size <= 1 || data.length <= 2) return data;

    const result = [];
    for (let i = 0; i < data.length; i++) {
        const start = Math.max(0, i - size + 1);
        result.push(average(data.slice(start, i + 1)));
    }
    return result;
}

function downloadCurrentCsv() {
    const metric = getActiveMetrics()[state.metric];
    if (!metric) return;

    const activeModels = getActiveModels();
    const rows = [];
    rows.push(['mode', 'scenario', 'metric', 'unit', 'model', 'index', 'raw_value', 'smoothed_value'].join(','));

    const scenario = state.modelVersion === '10' ? 'off_peak' : 'peak';

    for (const modelKey of activeModels) {
        const model = CONFIG.models[modelKey];
        const data = state.data[modelKey]?.[state.metric] || [];
        if (data.length === 0) continue;

        const smoothed = movingAverage(data, state.smoothingWindow);
        for (let i = 0; i < data.length; i++) {
            rows.push([
                escapeCsv(state.dataType),
                escapeCsv(scenario),
                escapeCsv(metric.name),
                escapeCsv(metric.unit || ''),
                escapeCsv(model.name),
                i + 1,
                toCsvNumber(data[i]),
                toCsvNumber(smoothed[i])
            ].join(','));
        }
    }

    if (rows.length <= 1) return;

    const csv = rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const metricSlug = slugify(metric.name);
    const filename = `traffic_${state.dataType}_${scenario}_${metricSlug}_w${state.smoothingWindow}.csv`;

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function escapeCsv(value) {
    const str = String(value ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

function toCsvNumber(value) {
    if (value === undefined || value === null || Number.isNaN(value)) return '';
    return Number(value).toString();
}

function slugify(value) {
    return String(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}
