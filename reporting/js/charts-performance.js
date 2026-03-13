window.drawPerformanceDashboard = function(events) {
    const rawData = [];
    const loadTimesByPath = new Map();
    const loadTimesByDate = new Map();

    // 1. Data Parsing & Cleanup
    events.filter(d => d.event_type === 'page_load' && d.raw_data?.performance?.totalLoadTime).forEach(ev => {
        if (!ev.created_at) return;
        
        const dateStr = ev.created_at.split(' ')[0];
        const loadTime = ev.raw_data.performance.totalLoadTime;

        let pathName = 'Unknown';
        try {
            const urlObj = new URL(ev.raw_data.url);
            let rawPath = urlObj.pathname;
            
            if (rawPath === '/' || rawPath === '/index.html' || rawPath === '/index.php') pathName = 'Home';
            else if (rawPath.includes('checkout')) pathName = 'Checkout';
            else if (rawPath.includes('product-detail')) pathName = 'Product Detail';
            else if (rawPath.includes('products')) pathName = 'Products';
            else pathName = rawPath.replace(/^\//, '');
        } catch (e) {}

        rawData.push({ date: dateStr, path: pathName, time: loadTime });

        // Group for Box Plot & Bar Chart
        if (!loadTimesByPath.has(pathName)) loadTimesByPath.set(pathName, []);
        loadTimesByPath.get(pathName).push(loadTime);

        // Group for Trend Line
        if (!loadTimesByDate.has(dateStr)) loadTimesByDate.set(dateStr, []);
        loadTimesByDate.get(dateStr).push(loadTime);
    });

    if (rawData.length === 0) {
        d3.select("#perf-trend-chart").html('<p>No performance data.</p>');
        return;
    }

    // Helper: Calculate Percentiles
    const getPercentile = (arr, p) => {
        if (arr.length === 0) return 0;
        const sorted = [...arr].sort((a, b) => a - b);
        const pos = (sorted.length - 1) * p;
        const base = Math.floor(pos);
        const rest = pos - base;
        if (sorted[base + 1] !== undefined) return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
        return sorted[base];
    };

    // Execute drawing functions
    drawTrendChart(loadTimesByDate, getPercentile);
    drawBarChart(loadTimesByPath, getPercentile);
    drawBoxPlot(loadTimesByPath);
};

// ==========================================
// Layer 1: Site Performance Trend (Time)
// ==========================================
function drawTrendChart(dataByDate, getP) {
    const container = d3.select("#perf-trend-chart");
    container.html("").style("position", "relative");

    const trendData = Array.from(dataByDate.entries()).map(([date, times]) => ({
        date: new Date(date + 'T00:00:00'),
        p50: getP(times, 0.50), // Median
        p90: getP(times, 0.90)  // 90th Percentile (Slowest 10%)
    })).sort((a, b) => a.date - b.date);

    const width = container.node().getBoundingClientRect().width || 800;
    const height = 250;
    const margin = {top: 40, right: 30, bottom: 30, left: 50};
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = container.append("svg").attr("width", width).attr("height", height)
        .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    container.insert("div", ":first-child").attr("class", "chart-title").text("Site Performance Trend (P50 vs P90)");

    const x = d3.scaleTime().domain(d3.extent(trendData, d => d.date)).range([0, innerW]);
    const y = d3.scaleLinear().domain([0, d3.max(trendData, d => d.p90) * 1.1]).range([innerH, 0]);

    // Draw P90 Line (Red/Orange - represents the slow outliers)
    svg.append("path").datum(trendData).attr("fill", "none").attr("stroke", "#e74c3c").attr("stroke-width", 2)
        .attr("d", d3.line().x(d => x(d.date)).y(d => y(d.p90)).curve(d3.curveMonotoneX));

    // Draw P50 Line (Green/Blue - represents the average user)
    svg.append("path").datum(trendData).attr("fill", "none").attr("stroke", "#2ecc71").attr("stroke-width", 2)
        .attr("d", d3.line().x(d => x(d.date)).y(d => y(d.p50)).curve(d3.curveMonotoneX));

    // Legend
    svg.append("circle").attr("cx", innerW - 100).attr("cy", -20).attr("r", 4).attr("fill", "#e74c3c");
    svg.append("text").attr("x", innerW - 90).attr("y", -16).attr("font-size", "11px").text("P90 (Slow)");
    svg.append("circle").attr("cx", innerW - 180).attr("cy", -20).attr("r", 4).attr("fill", "#2ecc71");
    svg.append("text").attr("x", innerW - 170).attr("y", -16).attr("font-size", "11px").text("P50 (Median)");

    svg.append("g").attr("transform", `translate(0,${innerH})`).call(d3.axisBottom(x).ticks(5).tickFormat(d3.timeFormat("%b %d")));
    svg.append("g").call(d3.axisLeft(y).ticks(5));
}

// ==========================================
// Layer 2: Page Performance Comparison (Bar)
// ==========================================
function drawBarChart(dataByPath, getP) {
    const container = d3.select("#perf-bar-chart");
    container.html("");

    // Calculate P90 for each path to find the truly slowest pages
    const barData = Array.from(dataByPath.entries()).map(([path, times]) => ({
        path: path,
        p90: getP(times, 0.90)
    })).sort((a, b) => b.p90 - a.p90); // Sort slowest to fastest

    const width = container.node().getBoundingClientRect().width || 400;
    const height = 300;
    const margin = {top: 40, right: 30, bottom: 40, left: 100};
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = container.append("svg").attr("width", width).attr("height", height)
        .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    container.insert("div", ":first-child").attr("class", "chart-title").text("P90 Load Time by Page (ms)");

    const x = d3.scaleLinear().domain([0, d3.max(barData, d => d.p90)]).range([0, innerW]);
    const y = d3.scaleBand().domain(barData.map(d => d.path)).range([0, innerH]).padding(0.2);

    svg.selectAll("rect").data(barData).join("rect")
        .attr("x", 0).attr("y", d => y(d.path))
        .attr("width", d => x(d.p90)).attr("height", y.bandwidth())
        .attr("fill", "#3498db");

    svg.selectAll("text.label").data(barData).join("text").attr("class", "label")
        .attr("x", d => x(d.p90) + 5).attr("y", d => y(d.path) + y.bandwidth()/2 + 4)
        .attr("font-size", "11px").text(d => Math.round(d.p90));

    svg.append("g").attr("transform", `translate(0,${innerH})`).call(d3.axisBottom(x).ticks(4));
    svg.append("g").call(d3.axisLeft(y).tickSizeOuter(0));
}

// ==========================================
// Layer 3: Distribution / Outliers (Box Plot)
// ==========================================
function drawBoxPlot(dataByPath) {
    const container = d3.select("#perf-box-plot");
    container.html("");

    const boxData = Array.from(dataByPath.entries()).map(([path, times]) => {
        const sorted = times.sort(d3.ascending);
        const q1 = d3.quantile(sorted, 0.25);
        const median = d3.quantile(sorted, 0.50);
        const q3 = d3.quantile(sorted, 0.75);
        const iqr = q3 - q1;
        const minVal = sorted[0];
        const maxVal = sorted[sorted.length - 1];
        
        // Exclude extreme outliers for the whiskers
        const min = Math.max(minVal, q1 - 1.5 * iqr);
        const max = Math.min(maxVal, q3 + 1.5 * iqr);
        const outliers = sorted.filter(v => v < min || v > max);

        return { path, q1, median, q3, iqr, min, max, outliers };
    });

    const width = container.node().getBoundingClientRect().width || 400;
    const height = 300;
    const margin = {top: 40, right: 20, bottom: 40, left: 100};
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = container.append("svg").attr("width", width).attr("height", height)
        .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    container.insert("div", ":first-child").attr("class", "chart-title").text("Load Time Distribution (ms)");

    // Global min/max across all paths to set a uniform X axis
    const globalMax = d3.max(boxData, d => d3.max([d.max, ...d.outliers]));
    const x = d3.scaleLinear().domain([0, globalMax * 1.05]).range([0, innerW]);
    const y = d3.scaleBand().domain(boxData.map(d => d.path)).range([0, innerH]).padding(0.4);

    const group = svg.selectAll("g.box").data(boxData).join("g").attr("class", "box")
        .attr("transform", d => `translate(0,${y(d.path)})`);

    // Main Box (Q1 to Q3)
    group.append("rect")
        .attr("x", d => x(d.q1)).attr("y", 0)
        .attr("width", d => x(d.q3) - x(d.q1)).attr("height", y.bandwidth())
        .attr("stroke", "#2c3e50").attr("fill", "#ecf0f1");

    // Median Line
    group.append("line")
        .attr("x1", d => x(d.median)).attr("x2", d => x(d.median))
        .attr("y1", 0).attr("y2", y.bandwidth())
        .attr("stroke", "#c0392b").attr("stroke-width", 2);

    // Whiskers (Min to Max)
    group.append("line").attr("x1", d => x(d.min)).attr("x2", d => x(d.q1)).attr("y1", y.bandwidth()/2).attr("y2", y.bandwidth()/2).attr("stroke", "#2c3e50");
    group.append("line").attr("x1", d => x(d.max)).attr("x2", d => x(d.q3)).attr("y1", y.bandwidth()/2).attr("y2", y.bandwidth()/2).attr("stroke", "#2c3e50");
    group.append("line").attr("x1", d => x(d.min)).attr("x2", d => x(d.min)).attr("y1", 0).attr("y2", y.bandwidth()).attr("stroke", "#2c3e50");
    group.append("line").attr("x1", d => x(d.max)).attr("x2", d => x(d.max)).attr("y1", 0).attr("y2", y.bandwidth()).attr("stroke", "#2c3e50");

    // Outliers (Dots)
    group.each(function(d) {
        d3.select(this).selectAll("circle").data(d.outliers).join("circle")
            .attr("cx", v => x(v)).attr("cy", y.bandwidth()/2).attr("r", 3)
            .attr("fill", "#7f8c8d").attr("opacity", 0.5);
    });

    svg.append("g").attr("transform", `translate(0,${innerH})`).call(d3.axisBottom(x).ticks(5));
    svg.append("g").call(d3.axisLeft(y).tickSizeOuter(0));
}

function drawErrorRateChart(events) {
    const chartContainer = d3.select("#error-rate-chart");
    if (chartContainer.empty()) return;
    
    chartContainer.html("");

    // 1. Data Parsing & Aggregation
    const errorStats = new Map();
    const errorTypes = new Set();

    events.filter(d => d.event_type === 'activity_update' || d.event_type === 'page_exit').forEach(ev => {
        const activities = ev.raw_data?.activities || [];
        const url = ev.raw_data?.url || 'unknown';
        
        let pathName = 'unknown';
        try {
            const urlObj = new URL(url);
            pathName = urlObj.pathname === '' ? '/' : urlObj.pathname;
        } catch (e) { pathName = url; }

        activities.forEach(act => {
            if (act.type === 'error') {
                // Categorize the error message
                let category = 'Other Error';
                const msg = act.message || '';
                if (msg.includes('ReferenceError')) category = 'ReferenceError';
                else if (msg.includes('TypeError')) category = 'TypeError';
                else if (msg.includes('RangeError')) category = 'RangeError';
                else if (msg.includes('SyntaxError')) category = 'SyntaxError';

                errorTypes.add(category);

                if (!errorStats.has(pathName)) {
                    errorStats.set(pathName, { path: pathName, total: 0 });
                }
                
                const stat = errorStats.get(pathName);
                stat[category] = (stat[category] || 0) + 1;
                stat.total += 1;
            }
        });
    });

    const flatData = Array.from(errorStats.values()).sort((a, b) => b.total - a.total);
    const keys = Array.from(errorTypes);

    if (flatData.length === 0) {
        chartContainer.html('<p class="chart-empty-state">No JavaScript errors recorded.</p>');
        return;
    }

    // Fill missing keys with 0 for the d3.stack generator
    flatData.forEach(d => { keys.forEach(k => { if (!d[k]) d[k] = 0; }); });

    // 2. Setup Dimensions
    const width = 560;
    // Dynamic height based on number of paths to prevent squishing
    const height = Math.max(250, flatData.length * 40 + 100); 
    const margin = {top: 50, right: 20, bottom: 40, left: 120};
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = chartContainer.append("svg")
        .attr("width", width).attr("height", height)
        .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // Title
    chartContainer.insert("div", ":first-child")
        .attr("class", "chart-title")
        .text("JavaScript Error Rates by Page");

    const tooltip = chartContainer.append("div").attr("class", "chart-tooltip");

    // 3. Scales, Colors, and Stack
    const y = d3.scaleBand().domain(flatData.map(d => d.path)).range([0, innerHeight]).padding(0.2);
    const xMax = d3.max(flatData, d => d.total);
    const x = d3.scaleLinear().domain([0, xMax]).range([0, innerWidth]);
    
    // Categorical colors for error types
    const color = d3.scaleOrdinal()
        .domain(['ReferenceError', 'TypeError', 'RangeError', 'SyntaxError', 'Other Error'])
        .range(['#e74c3c', '#e67e22', '#f1c40f', '#9b59b6', '#95a5a6']);

    const stackedData = d3.stack().keys(keys)(flatData);

    // 4. Draw Stacked Bars
    svg.append("g")
        .selectAll("g")
        .data(stackedData)
        .join("g")
        .attr("fill", d => color(d.key))
        .selectAll("rect")
        .data(d => d)
        .join("rect")
            .attr("y", d => y(d.data.path))
            .attr("x", d => x(d[0]))
            .attr("width", d => Math.max(0, x(d[1]) - x(d[0])))
            .attr("height", y.bandwidth())
            .style("cursor", "pointer")
            .on("mouseover", function(event, d) {
                d3.select(this).style("opacity", 0.8);
                const category = d3.select(this.parentNode).datum().key;
                const count = d[1] - d[0];
                tooltip.style("opacity", 1)
                       .html(`<strong>${d.data.path}</strong><br>${category}: ${count} error(s)`);
            })
            .on("mousemove", (event) => {
                tooltip.style("left", (event.pageX + 10) + "px")
                       .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", function() {
                d3.select(this).style("opacity", 1);
                tooltip.style("opacity", 0);
            });

    // 5. Axes
    svg.append("g")
        .attr("class", "chart-axis")
        .call(d3.axisLeft(y).tickSizeOuter(0))
        .selectAll("text")
        .style("text-anchor", "end")
        .attr("dx", "-.8em")
        .attr("dy", ".15em");

    svg.append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .attr("class", "chart-axis")
        .call(d3.axisBottom(x).ticks(Math.min(5, xMax)).tickFormat(d3.format("d"))); // Force integer ticks
};