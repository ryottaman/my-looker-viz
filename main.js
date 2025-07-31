/* ===========================================
   Image Scatter Plot - Looker Studio Custom Visualization
   メインJavaScript
   =========================================== */

// Looker Studio Community Visualization APIの初期化
const dscc = window.lookerStudioCommunityViz.init();

// グローバル変数
let svg, g, width, height;
let xScale, yScale, sizeScale;
let xAxisGroup, yAxisGroup, gridGroup;
let tooltip;
let currentData = null;
let currentStyle = null;

// マージン設定
const margin = {
    top: 40,
    right: 60,
    bottom: 60,
    left: 80
};

// 初期化関数
function initialize() {
    console.log('Image Scatter Plot: 初期化開始');
    
    // ローディング表示
    showLoading(true);
    
    // SVG要素の取得と設定
    svg = d3.select('#scatter-plot-svg');
    
    // メイングループ
    g = svg.append('g')
        .attr('class', 'main-group')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // グリッドグループ
    gridGroup = g.append('g').attr('class', 'grid-group');
    
    // 軸グループ
    xAxisGroup = g.append('g').attr('class', 'x-axis');
    yAxisGroup = g.append('g').attr('class', 'y-axis');
    
    // 画像グループ
    g.append('g').attr('class', 'images-group');
    
    // ツールチップの初期化
    tooltip = d3.select('#tooltip');
    
    console.log('Image Scatter Plot: 初期化完了');
}

// メイン描画関数
function drawVisualization(data) {
    console.log('Image Scatter Plot: データ受信', data);
    
    try {
        // データ検証
        if (!validateData(data)) {
            showError('無効なデータ形式です');
            return;
        }
        
        // ローディング非表示
        showLoading(false);
        hideError();
        
        // グローバル変数に保存
        currentData = data;
        currentStyle = data.style || {};
        
        // コンテナサイズの更新
        updateDimensions();
        
        // データの前処理
        const processedData = processData(data);
        
        if (!processedData || processedData.length === 0) {
            showError('表示可能なデータがありません');
            return;
        }
        
        // スケールの設定
        setupScales(processedData);
        
        // 軸の描画
        drawAxes();
        
        // グリッドの描画
        drawGrid();
        
        // 画像の描画
        drawImages(processedData);
        
        // 軸ラベルの描画
        drawAxisLabels();
        
        console.log('Image Scatter Plot: 描画完了');
        
    } catch (error) {
        console.error('Image Scatter Plot: 描画エラー', error);
        showError('描画中にエラーが発生しました: ' + error.message);
    }
}

// データの検証
function validateData(data) {
    if (!data || !data.tables || !data.tables.DEFAULT) {
        console.error('データテーブルが見つかりません');
        return false;
    }
    
    if (!data.fields) {
        console.error('フィールド情報が見つかりません');
        return false;
    }
    
    // 必須フィールドの確認
    const requiredFields = ['creativeId', 'imageUrl', 'xMetric', 'yMetric'];
    for (const field of requiredFields) {
        if (!data.fields[field] || data.fields[field].length === 0) {
            console.error(`必須フィールド ${field} が見つかりません`);
            return false;
        }
    }
    
    return true;
}

// データの前処理
function processData(data) {
    const tableData = data.tables.DEFAULT;
    const fields = data.fields;
    
    // フィールドIDの取得
    const creativeIdField = fields.creativeId[0].id;
    const imageUrlField = fields.imageUrl[0].id;
    const xMetricField = fields.xMetric[0].id;
    const yMetricField = fields.yMetric[0].id;
    const sizeMetricField = fields.sizeMetric && fields.sizeMetric.length > 0 ? fields.sizeMetric[0].id : null;
    
    // データの変換
    const processedData = tableData.map((row, index) => {
        const xValue = parseFloat(row[xMetricField]) || 0;
        const yValue = parseFloat(row[yMetricField]) || 0;
        const sizeValue = sizeMetricField ? parseFloat(row[sizeMetricField]) || 1 : 1;
        
        return {
            id: `item-${index}`,
            creativeId: row[creativeIdField] || `Creative ${index + 1}`,
            imageUrl: row[imageUrlField] || '',
            xValue: xValue,
            yValue: yValue,
            sizeValue: sizeValue,
            originalData: row
        };
    }).filter(d => {
        // 無効なデータを除外
        return d.imageUrl && 
               !isNaN(d.xValue) && 
               !isNaN(d.yValue) && 
               d.xValue !== null && 
               d.yValue !== null;
    });
    
    console.log('処理済みデータ:', processedData);
    return processedData;
}

// コンテナサイズの更新
function updateDimensions() {
    const container = document.getElementById('visualization-container');
    const containerRect = container.getBoundingClientRect();
    
    const totalWidth = containerRect.width;
    const totalHeight = containerRect.height;
    
    width = totalWidth - margin.left - margin.right;
    height = totalHeight - margin.top - margin.bottom;
    
    // 最小サイズの制限
    width = Math.max(width, 200);
    height = Math.max(height, 150);
    
    svg.attr('width', totalWidth)
       .attr('height', totalHeight);
}

// スケールの設定
function setupScales(data) {
    // X軸の範囲
    const xExtent = d3.extent(data, d => d.xValue);
    const xPadding = (xExtent[1] - xExtent[0]) * 0.1;
    
    xScale = d3.scaleLinear()
        .domain([
            Math.max(0, xExtent[0] - xPadding),
            xExtent[1] + xPadding
        ])
        .range([0, width])
        .nice();
    
    // Y軸の範囲
    const yExtent = d3.extent(data, d => d.yValue);
    const yPadding = (yExtent[1] - yExtent[0]) * 0.1;
    
    yScale = d3.scaleLinear()
        .domain([
            Math.max(0, yExtent[0] - yPadding),
            yExtent[1] + yPadding
        ])
        .range([height, 0])
        .nice();
    
    // サイズスケール
    const sizeExtent = d3.extent(data, d => d.sizeValue);
    const minSize = parseInt(getStyleValue('minImageSize', 20));
    const maxSize = parseInt(getStyleValue('maxImageSize', 80));
    
    sizeScale = d3.scaleSqrt()
        .domain(sizeExtent)
        .range([minSize, maxSize]);
}

// 軸の描画
function drawAxes() {
    // X軸
    const xAxis = d3.axisBottom(xScale)
        .ticks(5)
        .tickFormat(d => `${(d * 100).toFixed(1)}%`);
    
    xAxisGroup
        .attr('transform', `translate(0,${height})`)
        .transition()
        .duration(500)
        .call(xAxis);
    
    // Y軸
    const yAxis = d3.axisLeft(yScale)
        .ticks(5)
        .tickFormat(d => `${(d * 100).toFixed(1)}%`);
    
    yAxisGroup
        .transition()
        .duration(500)
        .call(yAxis);
}

// グリッドの描画
function drawGrid() {
    const showGridLines = getStyleValue('showGridLines', true);
    
    if (!showGridLines) {
        gridGroup.selectAll('*').remove();
        return;
    }
    
    // X軸グリッド
    const xGrid = d3.axisBottom(xScale)
        .ticks(5)
        .tickSize(-height)
        .tickFormat('');
    
    // Y軸グリッド
    const yGrid = d3.axisLeft(yScale)
        .ticks(5)
        .tickSize(-width)
        .tickFormat('');
    
    // グリッドの描画
    gridGroup.selectAll('.x-grid').remove();
    gridGroup.selectAll('.y-grid').remove();
    
    gridGroup.append('g')
        .attr('class', 'grid x-grid')
        .attr('transform', `translate(0,${height})`)
        .call(xGrid);
    
    gridGroup.append('g')
        .attr('class', 'grid y-grid')
        .call(yGrid);
}

// 画像の描画
function drawImages(data) {
    const imagesGroup = g.select('.images-group');
    
    // データバインディング
    const images = imagesGroup.selectAll('.creative-image')
        .data(data, d => d.id);
    
    // 新しい画像の追加
    const imagesEnter = images.enter()
        .append('image')
        .attr('class', 'creative-image')
        .attr('xlink:href', d => d.imageUrl)
        .style('opacity', 0);
    
    // 画像の更新
    images.merge(imagesEnter)
        .transition()
        .duration(500)
        .style('opacity', 1)
        .attr('x', d => xScale(d.xValue) - sizeScale(d.sizeValue) / 2)
        .attr('y', d => yScale(d.yValue) - sizeScale(d.sizeValue) / 2)
        .attr('width', d => sizeScale(d.sizeValue))
        .attr('height', d => sizeScale(d.sizeValue));
    
    // 古い画像の削除
    images.exit()
        .transition()
        .duration(300)
        .style('opacity', 0)
        .remove();
    
    // イベントハンドラーの設定
    setupImageEvents(imagesGroup.selectAll('.creative-image'));
}

// 画像のイベントハンドラー設定
function setupImageEvents(selection) {
    const showTooltips = getStyleValue('showTooltips', true);
    
    if (!showTooltips) {
        selection.on('mouseover', null)
                 .on('mousemove', null)
                 .on('mouseout', null);
        return;
    }
    
    selection
        .on('mouseover', function(event, d) {
            // ツールチップの表示
            const tooltipContent = `
                <div class="tooltip-title">${d.creativeId}</div>
                <div class="tooltip-content">
                    <div class="tooltip-row">
                        <span class="tooltip-label">X軸値:</span>
                        <span class="tooltip-value">${(d.xValue * 100).toFixed(2)}%</span>
                    </div>
                    <div class="tooltip-row">
                        <span class="tooltip-label">Y軸値:</span>
                        <span class="tooltip-value">${(d.yValue * 100).toFixed(2)}%</span>
                    </div>
                    <div class="tooltip-row">
                        <span class="tooltip-label">サイズ値:</span>
                        <span class="tooltip-value">${d.sizeValue.toLocaleString()}</span>
                    </div>
                </div>
            `;
            
            tooltip.html(tooltipContent)
                   .classed('visible', true);
        })
        .on('mousemove', function(event) {
            // ツールチップの位置更新
            const [mouseX, mouseY] = d3.pointer(event, document.body);
            
            tooltip.style('left', (mouseX + 10) + 'px')
                   .style('top', (mouseY - 10) + 'px');
        })
        .on('mouseout', function() {
            // ツールチップの非表示
            tooltip.classed('visible', false);
        });
}

// 軸ラベルの描画
function drawAxisLabels() {
    const xLabel = getStyleValue('xLabel', 'CTR (%)');
    const yLabel = getStyleValue('yLabel', 'CVR (%)');
    
    // 既存のラベルを削除
    svg.selectAll('.axis-label').remove();
    
    // X軸ラベル
    svg.append('text')
        .attr('class', 'axis-label x-axis-label')
        .attr('x', margin.left + width / 2)
        .attr('y', margin.top + height + 45)
        .text(xLabel);
    
    // Y軸ラベル
    svg.append('text')
        .attr('class', 'axis-label y-axis-label')
        .attr('transform', 'rotate(-90)')
        .attr('x', -(margin.top + height / 2))
        .attr('y', 20)
        .text(yLabel);
}

// スタイル値の取得ヘルパー関数
function getStyleValue(key, defaultValue) {
    if (currentStyle && currentStyle[key] && currentStyle[key].value !== undefined) {
        return currentStyle[key].value;
    }
    return defaultValue;
}

// ローディング表示の制御
function showLoading(show) {
    const loading = document.getElementById('loading');
    loading.style.display = show ? 'block' : 'none';
}

// エラー表示の制御
function showError(message) {
    const errorElement = document.getElementById('error-message');
    const errorText = errorElement.querySelector('.error-text');
    
    errorText.textContent = message;
    errorElement.style.display = 'block';
    showLoading(false);
}

function hideError() {
    const errorElement = document.getElementById('error-message');
    errorElement.style.display = 'none';
}

// ウィンドウリサイズのハンドリング
function handleResize() {
    if (currentData) {
        console.log('Image Scatter Plot: リサイズ検出');
        drawVisualization(currentData);
    }
}

// 初期化の実行
document.addEventListener('DOMContentLoaded', function() {
    console.log('Image Scatter Plot: DOM読み込み完了');
    initialize();
});

// ウィンドウリサイズイベント
window.addEventListener('resize', debounce(handleResize, 250));

// Looker Studioデータ購読
dscc.subscribeToData(drawVisualization, {
    transform: dscc.objectTransform
});

// ユーティリティ関数: デバウンス
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

// エラーハンドリング: グローバルエラー
window.addEventListener('error', function(event) {
    console.error('Image Scatter Plot: グローバルエラー', event.error);
    showError('予期しないエラーが発生しました');
});

console.log('Image Scatter Plot: スクリプト読み込み完了');
