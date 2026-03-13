window.drawPerformanceDashboard = function(events) {
    const rawData = [];
    const loadTimesByPath = new Map();
    const loadTimesByDate = new Map();
    const SLOW_THRESHOLD = 3000; // ms - used for slow rate calculation

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

        if (!loadTimesByPath.has(pathName)) loadTimesByPath.set(pathName, []);
        loadTimesByPath.get(pathName).push(loadTime);

        if (!loadTimesByDate.has(dateStr)) loadTimesByDate.set(dateStr, []);
        loadTimesByDate.get(dateStr).push(loadTime);
    });

    if (rawData.length === 0) {
        d3.select("#perf-trend-chart").html('<p class="chart-empty-state">No performance data available.</p>');
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
    drawPageComparisonChart(loadTimesByPath, getPercentile);
    if (document.getElementById("perf-box-plot")) {
        drawSlowLoadRateChart(loadTimesByPath, SLOW_THRESHOLD);
    }
    drawInsightPanel(loadTimesByPath, loadTimesByDate, getPercentile, SLOW_THRESHOLD);
};


// ==========================================
// Performance Band Thresholds
// ==========================================
const PERF_BANDS = {
    excellent: { max: 500, color: '#28a745', label: 'Excellent' },
    good: { max: 1500, color: '#ffc107', label: 'Good' },
    slow: { max: 3000, color: '#fd7e14', label: 'Slow' },
    poor: { max: Infinity, color: '#dc3545', label: 'Poor' }
};

function getPerformanceStatus(ms) {
    if (ms <= PERF_BANDS.excellent.max) return { ...PERF_BANDS.excellent, ms };
    if (ms <= PERF_BANDS.good.max) return { ...PERF_BANDS.good, ms };
    if (ms <= PERF_BANDS.slow.max) return { ...PERF_BANDS.slow, ms };
    return { ...PERF_BANDS.poor, ms };
}

// ==========================================
// Chart 1: Trend with Performance Bands
// ==========================================
function drawTrendChart(dataByDate, getP) {
    const container = d3.select("#perf-trend-chart");
    container.html("").style("position", "relative");

    const trendData = Array.from(dataByDate.entries()).map(([date, times]) => ({
        date: new Date(date + 'T00:00:00'),
        p50: getP(times, 0.50),
        p90: getP(times, 0.90),
        allValues: times
    })).sort((a, b) => a.date - b.date);

    if (trendData.length === 0) return;

    const width = container.node().getBoundingClientRect().width || 800;
    const height = 300;
    const margin = { top: 50, right: 30, bottom: 30, left: 60 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = container.append("svg").attr("width", width).attr("height", height)
        .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    container.insert("div", ":first-child").attr("class", "chart-title").text("Site Performance Over Time");
    container.insert("p", "div + div").attr("class", "chart-subtitle").html("Typical vs Slow Load Time with Performance Zones");

    const x = d3.scaleTime().domain(d3.extent(trendData, d => d.date)).range([0, innerW]);
    const yMax = d3.max(trendData, d => d.p90) * 1.15;
    const y = d3.scaleLinear().domain([0, yMax]).range([innerH, 0]);

    // Performance band backgrounds
    const bandData = [
        { max: 500, color: '#d4edda', label: 'Excellent' },
        { max: 1500, color: '#fff3cd', label: 'Good' },
        { max: 3000, color: '#ffe5d4', label: 'Slow' },
        { max: yMax, color: '#f8d7da', label: 'Poor' }
    ];
    let prevMax = 0;
    bandData.forEach(band => {
        svg.append("rect")
            .attr("x", 0).attr("y", y(band.max))
            .attr("width", innerW).attr("height", y(prevMax) - y(band.max))
            .attr("fill", band.color).attr("opacity", 0.3);
        prevMax = band.max;
    });

    // P90 Line (Slow Load Time)
    svg.append("path").datum(trendData).attr("fill", "none").attr("stroke", "#dc3545").attr("stroke-width", 2.5)
        .attr("d", d3.line().x(d => x(d.date)).y(d => y(d.p90)).curve(d3.curveMonotoneX));

    // P50 Line (Typical Load Time)
    svg.append("path").datum(trendData).attr("fill", "none").attr("stroke", "#007bff").attr("stroke-width", 2.5)
        .attr("d", d3.line().x(d => x(d.date)).y(d => y(d.p50)).curve(d3.curveMonotoneX));

    // Legend
    const legendX = innerW - 240;
    svg.append("circle").attr("cx", legendX).attr("cy", -35).attr("r", 4).attr("fill", "#007bff");
    svg.append("text").attr("x", legendX + 12).attr("y", -30).attr("font-size", "12px").text("Typical Load Time (Median)");
    svg.append("circle").attr("cx", legendX).attr("cy", -18).attr("r", 4).attr("fill", "#dc3545");
    svg.append("text").attr("x", legendX + 12).attr("y", -13).attr("font-size", "12px").text("Slow Load Time (90th %)");

    // Tooltip
    const tooltip = container.append("div").attr("class", "chart-tooltip");

    svg.append("g").attr("transform", `translate(0,${innerH})`).call(d3.axisBottom(x).ticks(5).tickFormat(d3.timeFormat("%b %d")));
    svg.append("g").call(d3.axisLeft(y).ticks(5).tickFormat(d => d + " ms"));

    // Interactive hover
    const hoverLine = svg.append("line").attr("class", "hover-line").attr("y1", 0).attr("y2", innerH);
    const bisectDate = d3.bisector(d => d.date).left;

    svg.append("rect")
        .attr("width", innerW).attr("height", innerH)
        .attr("fill", "none").attr("pointer-events", "all")
        .on("mouseover", () => { hoverLine.style("opacity", 1); tooltip.style("opacity", 1); })
        .on("mouseout", () => { hoverLine.style("opacity", 0); tooltip.style("opacity", 0); })
        .on("mousemove", (event) => {
            const x0 = x.invert(d3.pointer(event)[0]);
            const i = bisectDate(trendData, x0, 1);
            const d0 = trendData[i - 1];
            const d1 = trendData[i];
            let d = d0;
            if (d0 && d1) d = x0 - d0.date > d1.date - x0 ? d1 : d0;
            else d = d1 || d0;

            if (!d) return;

            const cx = x(d.date);
            hoverLine.attr("x1", cx).attr("x2", cx);

            const dateStr = d3.timeFormat("%b %d, %Y")(d.date);
            const typicalStatus = getPerformanceStatus(Math.round(d.p50));
            const slowStatus = getPerformanceStatus(Math.round(d.p90));

            tooltip.html(`
                <div style="font-weight: bold; margin-bottom: 4px;">${dateStr}</div>
                <div style="margin-bottom: 2px;">Typical Load Time: <strong>${Math.round(d.p50)} ms</strong><span style="font-size: 11px; color: #666;"> (${typicalStatus.label})</span></div>
                <div>Slow Load Time: <strong>${Math.round(d.p90)} ms</strong><span style="font-size: 11px; color: #666;"> (${slowStatus.label})</span></div>
            `);

            let tipX = cx + margin.left + 15;
            if (tipX + 200 > window.innerWidth) tipX = cx + margin.left - 200;
            tooltip.style("left", `${tipX}px`).style("top", `${margin.top + y(d.p50) / 2}px`);
        });
}

// ==========================================
// Chart 2: Page Comparison (Grouped Bars)
// ==========================================
function drawPageComparisonChart(dataByPath, getP) {
    const container = d3.select("#perf-bar-chart");
    container.html("");

    const pageData = Array.from(dataByPath.entries())
        .map(([path, times]) => ({
            path,
            typical: getP(times, 0.50),
            slow: getP(times, 0.90),
            count: times.length
        }))
        .sort((a, b) => b.slow - a.slow); // Sort by slow load time

    if (pageData.length === 0) return;

    const width = container.node().getBoundingClientRect().width || 500;
    const height = 250 + pageData.length * 20;
    const margin = { top: 50, right: 30, bottom: 40, left: 120 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = container.append("svg").attr("width", width).attr("height", height)
        .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    container.insert("div", ":first-child").attr("class", "chart-title").text("Performance by Page");
    container.insert("p", "div + div").attr("class", "chart-subtitle").html("Typical vs Slow Load Time (sorted by slow performance)");

    const x = d3.scaleLinear().domain([0, d3.max(pageData, d => d.slow) * 1.1]).range([0, innerW]);
    const y = d3.scaleBand().domain(pageData.map(d => d.path)).range([0, innerH]).padding(0.3);

    const tooltip = container.append("div").attr("class", "chart-tooltip");

    // Grouped bars
    const barG = svg.selectAll("g.page-group").data(pageData).join("g").attr("class", "page-group")
        .attr("transform", d => `translate(0,${y(d.path)})`);

    // Typical bar (blue)
    barG.append("rect")
        .attr("x", 0).attr("y", 0)
        .attr("width", d => x(d.typical)).attr("height", y.bandwidth() / 2 - 2)
        .attr("fill", "#007bff").attr("opacity", 0.8)
        .style("cursor", "pointer")
        .on("mouseover", function(event, d) {
            d3.select(this).attr("opacity", 1);
            tooltip.style("opacity", 1).html(`
                <div style="font-weight: bold; margin-bottom: 4px;">${d.path}</div>
                <div>Typical Load Time: <strong>${Math.round(d.typical)} ms</strong></div>
                <div style="font-size: 11px; color: #666;">Based on ${d.count} page loads</div>
            `);
        })
        .on("mousemove", (event) => {
            tooltip.style("left", (event.pageX + 10) + "px").style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function() { d3.select(this).attr("opacity", 0.8); tooltip.style("opacity", 0); });

    // Slow bar (red) - offset below
    barG.append("rect")
        .attr("x", 0).attr("y", y.bandwidth() / 2 + 2)
        .attr("width", d => x(d.slow)).attr("height", y.bandwidth() / 2 - 2)
        .attr("fill", "#dc3545").attr("opacity", 0.8)
        .style("cursor", "pointer")
        .on("mouseover", function(event, d) {
            d3.select(this).attr("opacity", 1);
            tooltip.style("opacity", 1).html(`
                <div style="font-weight: bold; margin-bottom: 4px;">${d.path}</div>
                <div>Slow Load Time: <strong>${Math.round(d.slow)} ms</strong> (slowest 10% of loads)</div>
                <div style="font-size: 11px; color: #666;">Based on ${d.count} page loads</div>
            `);
        })
        .on("mousemove", (event) => {
            tooltip.style("left", (event.pageX + 10) + "px").style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function() { d3.select(this).attr("opacity", 0.8); tooltip.style("opacity", 0); });

    // Value labels
    barG.append("text")
        .attr("x", d => x(d.typical) + 5).attr("y", y.bandwidth() / 4 + 3)
        .attr("font-size", "11px").attr("fill", "#333").text(d => Math.round(d.typical) + " ms");

    barG.append("text")
        .attr("x", d => x(d.slow) + 5).attr("y", y.bandwidth() / 2 + 12)
        .attr("font-size", "11px").attr("fill", "#333").text(d => Math.round(d.slow) + " ms");

    // Legend
    svg.append("circle").attr("cx", innerW - 160).attr("cy", -35).attr("r", 4).attr("fill", "#007bff");
    svg.append("text").attr("x", innerW - 150).attr("y", -31).attr("font-size", "11px").text("Typical (Median)");
    svg.append("circle").attr("cx", innerW - 160).attr("cy", -18).attr("r", 4).attr("fill", "#dc3545");
    svg.append("text").attr("x", innerW - 150).attr("y", -14).attr("font-size", "11px").text("Slow (90th %)");

    svg.append("g").attr("transform", `translate(0,${innerH})`).call(d3.axisBottom(x).ticks(4).tickFormat(d => d + " ms"));
    svg.append("g").call(d3.axisLeft(y).tickSizeOuter(0));
}

// ==========================================
// Chart 3: Slow Load Rate
// ==========================================
function drawSlowLoadRateChart(dataByPath, threshold) {
    const container = d3.select("#perf-box-plot");
    container.html("");

    const slowRateData = Array.from(dataByPath.entries())
        .map(([path, times]) => {
            const slowCount = times.filter(t => t > threshold).length;
            const slowPercent = (slowCount / times.length) * 100;
            return { path, slowCount, totalCount: times.length, slowPercent };
        })
        .sort((a, b) => b.slowPercent - a.slowPercent);

    if (slowRateData.length === 0) return;

    const width = container.node().getBoundingClientRect().width || 500;
    const height = 250 + slowRateData.length * 20;
    const margin = { top: 50, right: 30, bottom: 40, left: 120 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = container.append("svg").attr("width", width).attr("height", height)
        .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    container.insert("div", ":first-child").attr("class", "chart-title").text(`Slow Load Rate by Page (> ${threshold} ms)`);
    container.insert("p", "div + div").attr("class", "chart-subtitle").html("Percentage of page loads considered slow");

    const x = d3.scaleLinear().domain([0, 100]).range([0, innerW]);
    const y = d3.scaleBand().domain(slowRateData.map(d => d.path)).range([0, innerH]).padding(0.4);

    const tooltip = container.append("div").attr("class", "chart-tooltip");

    // Color bars by intensity
    svg.selectAll("rect.slow-bar").data(slowRateData).join("rect").attr("class", "slow-bar")
        .attr("x", 0).attr("y", d => y(d.path))
        .attr("width", d => x(d.slowPercent)).attr("height", y.bandwidth())
        .attr("fill", d => {
            if (d.slowPercent < 10) return "#28a745";
            if (d.slowPercent < 25) return "#ffc107";
            if (d.slowPercent < 50) return "#fd7e14";
            return "#dc3545";
        })
        .style("cursor", "pointer")
        .on("mouseover", function(event, d) {
            d3.select(this).style("opacity", 0.8);
            tooltip.style("opacity", 1).html(`
                <div style="font-weight: bold; margin-bottom: 4px;">${d.path}</div>
                <div>Slow Load Rate: <strong>${d.slowPercent.toFixed(1)}%</strong></div>
                <div style="font-size: 11px; color: #666;">${d.slowCount} of ${d.totalCount} loads were slow</div>
            `);
        })
        .on("mousemove", (event) => {
            tooltip.style("left", (event.pageX + 10) + "px").style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function() { d3.select(this).style("opacity", 1); tooltip.style("opacity", 0); });

    // Percentage labels
    svg.selectAll("text.slow-label").data(slowRateData).join("text").attr("class", "slow-label")
        .attr("x", d => x(d.slowPercent) + 5).attr("y", d => y(d.path) + y.bandwidth() / 2 + 4)
        .attr("font-size", "12px").attr("font-weight", "bold").attr("fill", "#333")
        .text(d => d.slowPercent.toFixed(1) + "%");

    svg.append("g").attr("transform", `translate(0,${innerH})`).call(d3.axisBottom(x).ticks(5).tickFormat(d => d + "%"));
    svg.append("g").call(d3.axisLeft(y).tickSizeOuter(0));
}

// ==========================================
// Insight Panel
// ==========================================
function drawInsightPanel(dataByPath, dataByDate, getP, slowThreshold) {
    const container = d3.select("#perf-trend-chart").node().parentNode;
    if (!container) return;

    // Calculate summary metrics
    const pages = Array.from(dataByPath.entries()).map(([path, times]) => ({
        path,
        typical: getP(times, 0.50),
        slow: getP(times, 0.90),
        count: times.length,
        slowPercent: ((times.filter(t => t > slowThreshold).length / times.length) * 100)
    }));

    const worstPage = pages.reduce((a, b) => a.slow > b.slow ? a : b);
    const bestPage = pages.reduce((a, b) => a.slow < b.slow ? a : b);
    const allTimes = Array.from(dataByPath.values()).flat();
    const siteTypical = getP(allTimes, 0.50);
    const siteSlow = getP(allTimes, 0.90);

    let insight = `<strong>Performance Summary:</strong> `;
    
    if (worstPage.slow > 3000) {
        insight += `The <strong>${worstPage.path}</strong> page is the slowest, with slow loads averaging ${Math.round(worstPage.slow)} ms. `;
    } else {
        insight += `Overall site performance is in the Good range, with typical loads around ${Math.round(siteTypical)} ms. `;
    }

    if (worstPage.slowPercent > worstPage.count * 0.2) {
        insight += `${worstPage.slowPercent.toFixed(0)}% of ${worstPage.path} loads exceed the 3-second threshold, indicating potential user frustration. `;
    }

    if (bestPage.slow < 1500) {
        insight += `The <strong>${bestPage.path}</strong> page performs excellently with consistent response times.`;
    }

    const panelDiv = document.createElement('div');
    panelDiv.className = 'perf-insight-panel';
    panelDiv.innerHTML = insight;
    container.appendChild(panelDiv);
}

function drawErrorRateChart(events) {
    const chartContainer = d3.select("#error-rate-chart");
    if (chartContainer.empty()) return;
    
    chartContainer.html("");

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

    flatData.forEach(d => { keys.forEach(k => { if (!d[k]) d[k] = 0; }); });

    const width = 560;
    const height = Math.max(250, flatData.length * 40 + 100);
    const margin = {top: 50, right: 20, bottom: 40, left: 120};
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = chartContainer.append("svg")
        .attr("width", width).attr("height", height)
        .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    chartContainer.insert("div", ":first-child")
        .attr("class", "chart-title")
        .text("JavaScript Error Rates by Page");

    const tooltip = chartContainer.append("div").attr("class", "chart-tooltip");

    const y = d3.scaleBand().domain(flatData.map(d => d.path)).range([0, innerHeight]).padding(0.2);
    const xMax = d3.max(flatData, d => d.total);
    const x = d3.scaleLinear().domain([0, xMax]).range([0, innerWidth]);
    
    const color = d3.scaleOrdinal()
        .domain(['ReferenceError', 'TypeError', 'RangeError', 'SyntaxError', 'Other Error'])
        .range(['#e74c3c', '#e67e22', '#f1c40f', '#9b59b6', '#95a5a6']);

    const stackedData = d3.stack().keys(keys)(flatData);

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
        .call(d3.axisBottom(x).ticks(Math.min(5, xMax)).tickFormat(d3.format("d")));
}