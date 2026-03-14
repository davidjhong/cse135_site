window.drawPerformanceDashboard = function(events) {
    // ==========================================
    // PAGE NORMALIZATION FOR LOAD-TIME ANALYTICS
    // ==========================================
    
    // Valid site pages that should appear as distinct buckets
    const VALID_PAGES = new Set([
        '/', 
        '/index.html', 
        '/index.php',
        '/products.html',
        '/products',
        '/product-detail.html',
        '/product-detail',
        '/checkout.html',
        '/checkout',
        '/liquidation.html',
        '/404.html'
    ]);

    // Map valid paths to display labels
    const PAGE_LABELS = {
        '/': 'Home',
        '/index.html': 'Home',
        '/index.php': 'Home',
        '/products.html': 'Products',
        '/products': 'Products',
        '/product-detail.html': 'Product Detail',
        '/product-detail': 'Product Detail',
        '/checkout.html': 'Checkout',
        '/checkout': 'Checkout',
        '/liquidation.html': 'Liquidation',
        '/404.html': '404'
    };

    // Normalize raw path to page bucket
    function normalizePagePath(rawPath) {
        if (!rawPath) {
            console.debug("[normalizePagePath] Empty path → 404");
            return '404';
        }
        
        // Remove query params and hash first
        const cleanPath = rawPath.split('?')[0].split('#')[0];
        
        // Try exact match (with any trailing slash variations)
        if (VALID_PAGES.has(cleanPath)) {
            const result = PAGE_LABELS[cleanPath] || cleanPath;
            console.debug(`[normalizePagePath] "${rawPath}" → "${result}" (exact match)`);
            return result;
        }
        
        // Try without trailing slash
        const trimmedPath = cleanPath.replace(/\/$/, '');
        if (VALID_PAGES.has(trimmedPath)) {
            const result = PAGE_LABELS[trimmedPath] || trimmedPath;
            console.debug(`[normalizePagePath] "${rawPath}" → "${result}" (trimmed)`);
            return result;
        }
        
        // Try with trailing slash added
        const withSlash = cleanPath.endsWith('/') ? cleanPath : cleanPath + '/';
        if (VALID_PAGES.has(withSlash)) {
            const result = PAGE_LABELS[withSlash] || withSlash;
            console.debug(`[normalizePagePath] "${rawPath}" → "${result}" (with slash)`);
            return result;
        }
        
        // If path doesn't match a known valid route, normalize to 404
        console.debug(`[normalizePagePath] "${rawPath}" → "404" (no match). cleanPath was "${cleanPath}", trimmedPath was "${trimmedPath}"`);
        return '404';
    }

    const rawData = [];
    const loadTimesByPath = new Map();
    const loadTimesByDate = new Map();

    // 1. Data Parsing & Cleanup
    events.filter(d => d.event_type === 'page_load' && d.raw_data?.performance?.totalLoadTime).forEach(ev => {
        if (!ev.created_at) return;
        
        const dateStr = ev.created_at.split(' ')[0];
        const loadTime = ev.raw_data.performance.totalLoadTime;

        let pathName = '404';
        try {
            const urlObj = new URL(ev.raw_data.url);
            let rawPath = urlObj.pathname;
            
            // Normalize raw path to valid page bucket
            pathName = normalizePagePath(rawPath);
        } catch (e) {
            pathName = '404';
        }

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

    // Debug: Log page normalization results
    const uniquePages = Array.from(loadTimesByPath.keys()).sort();
    console.log("[Performance Dashboard] ✓ Page paths normalized for load-time analytics");
    console.log("[Performance Dashboard] ✓ Normalized pages:", uniquePages);
    console.log("[Performance Dashboard] ✓ Total load events:", rawData.length);
    
    // Verify invalid paths were aggregated into 404
    const has404 = loadTimesByPath.has('404');
    if (has404) {
        const notFoundCount = loadTimesByPath.get('404').length;
        console.log("[Performance Dashboard] ✓ Invalid paths aggregated into 404 bucket:", notFoundCount, "events");
    }
    
    // Log valid pages for reference
    console.log("[Performance Dashboard] Valid pages configured:", Array.from(VALID_PAGES));

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
    drawTrafficVolumeChart(loadTimesByPath);
};

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

    const width = Math.max(container.node().getBoundingClientRect().width || 500, 500);
    const height = 300;
    const margin = { top: 50, right: 30, bottom: 30, left: 60 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = container.append("svg").attr("width", width).attr("height", height).style("max-width", "100%")
        .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    container.insert("div", ":first-child").attr("class", "chart-title").text("Overall Load Experience by Day");
    container.insert("p", "div + div").attr("class", "chart-subtitle").html("Sitewide aggregate across all recorded page-load events");

    const x = d3.scaleTime().domain(d3.extent(trendData, d => d.date)).range([0, innerW]);
    const yMax = d3.max(trendData, d => d.p90) * 1.15;
    const y = d3.scaleLinear().domain([0, yMax]).range([innerH, 0]);

    // Performance band backgrounds with stronger visual distinction
    const bandData = [
        { max: 500, color: '#c8e6c9', label: 'Excellent' },
        { max: 1500, color: '#ffe0b2', label: 'Good' },
        { max: 3000, color: '#ffccbc', label: 'Slow' },
        { max: yMax, color: '#ffcdd2', label: 'Poor' }
    ];
    let prevMax = 0;
    bandData.forEach((band, idx) => {
        // Band background rectangle
        svg.append("rect")
            .attr("x", 0).attr("y", y(band.max))
            .attr("width", innerW).attr("height", y(prevMax) - y(band.max))
            .attr("fill", band.color).attr("opacity", 0.5);
        // Boundary line between zones
        if (idx < bandData.length - 1) {
            svg.append("line")
                .attr("x1", 0).attr("x2", innerW)
                .attr("y1", y(band.max)).attr("y2", y(band.max))
                .attr("stroke", "#bbb").attr("stroke-width", 1).attr("opacity", 0.6);
        }
        prevMax = band.max;
    });

    // P50 Line (Typical Load Time) - draw first so it sits below
    svg.append("path").datum(trendData).attr("fill", "none").attr("stroke", "#0056b3").attr("stroke-width", 3)
        .attr("stroke-linecap", "round").attr("stroke-linejoin", "round")
        .attr("d", d3.line().x(d => x(d.date)).y(d => y(d.p50)).curve(d3.curveMonotoneX));

    // P90 Line (Slow Load Time) - draw last so it sits on top
    svg.append("path").datum(trendData).attr("fill", "none").attr("stroke", "#c82333").attr("stroke-width", 3)
        .attr("stroke-linecap", "round").attr("stroke-linejoin", "round")
        .attr("d", d3.line().x(d => x(d.date)).y(d => y(d.p90)).curve(d3.curveMonotoneX));

    // Legend
    const legendX = innerW - 240;
    svg.append("circle").attr("cx", legendX).attr("cy", -35).attr("r", 4).attr("fill", "#0056b3");
    svg.append("text").attr("x", legendX + 12).attr("y", -30).attr("font-size", "12px").text("Typical Load Time (Median)");
    svg.append("circle").attr("cx", legendX).attr("cy", -18).attr("r", 4).attr("fill", "#c82333");
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
                <div style="font-weight: bold; margin-bottom: 6px;">${dateStr}</div>
                <div style="margin-bottom: 4px;">
                    <div style="font-weight: 600; color: #007bff;">Typical Load Time: ${Math.round(d.p50)} ms</div>
                    <div style="font-size: 11px; color: #ccc; margin-top: 2px;">Median of all recorded page loads</div>
                </div>
                <div style="margin-bottom: 4px;">
                    <div style="font-weight: 600; color: #dc3545;">Slow Load Time: ${Math.round(d.p90)} ms</div>
                    <div style="font-size: 11px; color: #ccc; margin-top: 2px;">90th percentile of all recorded page loads</div>
                </div>
                <div style="border-top: 1px solid #666; padding-top: 4px; margin-top: 6px; font-size: 11px; color: #aaa;">
                    Status: <span style="color: ${typicalStatus.color};">${typicalStatus.label}</span> → <span style="color: ${slowStatus.color};">${slowStatus.label}</span>
                </div>
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
    container.html("").style("position", "relative");   

    const pageData = Array.from(dataByPath.entries())
        .map(([path, times]) => ({
            path,
            typical: getP(times, 0.50),
            slow: getP(times, 0.90),
            count: times.length
        }))
        .sort((a, b) => b.slow - a.slow); // Sort by slow load time

    if (pageData.length === 0) return;

    const width = Math.max(container.node().getBoundingClientRect().width || 500, 500);
    const height = 200 + pageData.length * 28;
    const margin = { top: 50, right: 30, bottom: 40, left: 120 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = container.append("svg").attr("width", width).attr("height", height).style("max-width", "100%")
        .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    container.insert("div", ":first-child").attr("class", "chart-title").text("Performance by Page");
    container.insert("p", "div + div").attr("class", "chart-subtitle").html("Typical vs Slow Load Time (sorted by slow performance)");

    const x = d3.scaleLinear().domain([0, d3.max(pageData, d => d.slow) * 1.1]).range([0, innerW]);
    const y = d3.scaleBand().domain(pageData.map(d => d.path)).range([0, innerH]).padding(0.25);

    const tooltip = container.append("div")
        .attr("class", "chart-tooltip")
        .style("opacity", 0)
        .style("position", "absolute")
        .style("pointer-events", "none")
        .style("z-index", "100");

    // Grouped bars
    const barG = svg.selectAll("g.page-group").data(pageData).join("g").attr("class", "page-group")
        .attr("transform", d => `translate(0,${y(d.path)})`);

    // Typical bar (blue)
    barG.append("rect")
        .attr("x", 0).attr("y", 0)
        .attr("width", d => x(d.typical)).attr("height", y.bandwidth() * 0.45)
        .attr("fill", "#007bff").attr("opacity", 0.85)
        .style("cursor", "pointer")
        .on("mouseover", function(event, d) {
            d3.select(this).attr("opacity", 1);
            const variance = d.slow - d.typical;
            const interpretation = variance > 1500 ? "High variance: some loads much slower than typical." : 
                                   variance > 800 ? "Moderate variance: occasional slow loads." : 
                                   "Low variance: consistent performance.";
            tooltip.style("opacity", 1).html(`
                <div style="font-weight: bold; margin-bottom: 6px;">${d.path}</div>
                <div style="margin-bottom: 4px;">
                    <div style="font-weight: 600; color: #0056b3;">Typical Load Time: ${Math.round(d.typical)} ms</div>
                    <div style="font-size: 11px; color: #ccc; margin-top: 2px;">Median of ${d.count} recorded loads</div>
                </div>
                <div style="border-top: 1px solid #666; padding-top: 4px; margin-top: 4px; font-size: 11px; color: #aaa;">
                    ${interpretation}
                </div>
            `);
        })
        .on("mousemove", (event) => {
            const [xPos, yPos] = d3.pointer(event, container.node());
            tooltip.style("left", (xPos + 15) + "px").style("top", (yPos - 28) + "px");
        })
        .on("mouseout", function() { d3.select(this).attr("opacity", 0.85); tooltip.style("opacity", 0); });

    // Slow bar (red) - offset below
    barG.append("rect")
        .attr("x", 0).attr("y", y.bandwidth() * 0.55)
        .attr("width", d => x(d.slow)).attr("height", y.bandwidth() * 0.45)
        .attr("fill", "#c82333").attr("opacity", 0.85)
        .style("cursor", "pointer")
        .on("mouseover", function(event, d) {
            d3.select(this).attr("opacity", 1);
            const slowStatus = getPerformanceStatus(Math.round(d.slow));
            tooltip.style("opacity", 1).html(`
                <div style="font-weight: bold; margin-bottom: 6px;">${d.path}</div>
                <div style="margin-bottom: 4px;">
                    <div style="font-weight: 600; color: #c82333;">Slow Load Time: ${Math.round(d.slow)} ms</div>
                    <div style="font-size: 11px; color: #ccc; margin-top: 2px;">90th percentile of ${d.count} recorded loads (slowest 10%)</div>
                </div>
                <div style="border-top: 1px solid #666; padding-top: 4px; margin-top: 4px; font-size: 11px;">
                    <span style="color: ${slowStatus.color}; font-weight: 600;">Status: ${slowStatus.label}</span>
                    <div style="color: #aaa; margin-top: 3px;">${d.slow > 1500 ? "Users may experience frustration on slow loads." : "Most users should not notice slowness."}</div>
                </div>
            `);
        })
        .on("mousemove", (event) => {
            const [xPos, yPos] = d3.pointer(event, container.node());
            tooltip.style("left", (xPos + 15) + "px").style("top", (yPos - 28) + "px");
        })
        .on("mouseout", function() { d3.select(this).attr("opacity", 0.85); tooltip.style("opacity", 0); });

    // Value labels
    barG.append("text")
        .attr("x", d => x(d.typical) + 5).attr("y", d => y.bandwidth() * 0.225 + 3)
        .attr("font-size", "11px").attr("fill", "#333").text(d => Math.round(d.typical) + " ms");

    barG.append("text")
        .attr("x", d => x(d.slow) + 5).attr("y", d => y.bandwidth() * 0.775 + 3)
        .attr("font-size", "11px").attr("fill", "#333").text(d => Math.round(d.slow) + " ms");

    // Legend
    svg.append("circle").attr("cx", innerW - 160).attr("cy", -35).attr("r", 4).attr("fill", "#0056b3");
    svg.append("text").attr("x", innerW - 150).attr("y", -31).attr("font-size", "11px").text("Typical (Median)");
    svg.append("circle").attr("cx", innerW - 160).attr("cy", -18).attr("r", 4).attr("fill", "#c82333");
    svg.append("text").attr("x", innerW - 150).attr("y", -14).attr("font-size", "11px").text("Slow (90th %)");

    svg.append("g").attr("transform", `translate(0,${innerH})`).call(d3.axisBottom(x).ticks(4).tickFormat(d => d + " ms"));
    svg.append("g").call(d3.axisLeft(y).tickSizeOuter(0));
}

// ==========================================
// Chart 3: Traffic Volume / Measurement Count
// ==========================================
function drawTrafficVolumeChart(dataByPath) {
    const container = d3.select("#perf-box-plot");
    container.html("").style("position", "relative");

    const totalLoadCount = Array.from(dataByPath.values()).reduce((sum, arr) => sum + arr.length, 0);

    const volumeData = Array.from(dataByPath.entries())
        .map(([path, times]) => {
            const count = times.length;
            const percent = (count / totalLoadCount) * 100;
            return { path, count, percent };
        })
        .sort((a, b) => b.count - a.count);

    if (volumeData.length === 0) return;

    const width = Math.max(container.node().getBoundingClientRect().width || 500, 500);
    const height = 200 + volumeData.length * 28;
    const margin = { top: 50, right: 30, bottom: 40, left: 120 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = container.append("svg").attr("width", width).attr("height", height).style("max-width", "100%")
        .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    container.insert("div", ":first-child").attr("class", "chart-title").text("Observed Page Loads by Page");
    container.insert("p", "div + div").attr("class", "chart-subtitle").html("Sample size supporting other metrics (total: " + totalLoadCount + " events)");

    const x = d3.scaleLinear().domain([0, d3.max(volumeData, d => d.count) * 1.05]).range([0, innerW]);
    const y = d3.scaleBand().domain(volumeData.map(d => d.path)).range([0, innerH]).padding(0.4);

    const tooltip = container.append("div")
        .attr("class", "chart-tooltip")
        .style("opacity", 0)
        .style("position", "absolute")
        .style("pointer-events", "none")
        .style("z-index", "100");

    // Bars colored by intensity (lighter blue for low volume, darker for high)
    svg.selectAll("rect.volume-bar").data(volumeData).join("rect").attr("class", "volume-bar")
        .attr("x", 0).attr("y", d => y(d.path))
        .attr("width", d => x(d.count)).attr("height", y.bandwidth())
        .attr("fill", d => {
            const intensity = d.percent / d3.max(volumeData, x => x.percent);
            return d3.interpolateBlues(0.4 + intensity * 0.5);
        })
        .style("cursor", "pointer")
        .on("mouseover", function(event, d) {
            d3.select(this).style("opacity", 0.9);
            tooltip.style("opacity", 1).html(`
                <div style="font-weight: bold; margin-bottom: 6px;">${d.path}</div>
                <div style="margin-bottom: 4px;">
                    <div style="font-weight: 600;">Recorded Load Events: ${d.count}</div>
                    <div style="font-size: 11px; color: #ccc; margin-top: 2px;">${d.percent.toFixed(1)}% of all observations</div>
                </div>
                <div style="border-top: 1px solid #666; padding-top: 4px; margin-top: 6px; font-size: 11px; color: #aaa;">
                    This sample size supports the load time metrics above.
                </div>
            `);
        })
        .on("mousemove", (event) => {
            const [xPos, yPos] = d3.pointer(event, container.node());
            tooltip.style("left", (xPos + 15) + "px").style("top", (yPos - 28) + "px");
        })
        .on("mouseout", function() { d3.select(this).style("opacity", 1); tooltip.style("opacity", 0); });

    // Count labels
    svg.selectAll("text.volume-label").data(volumeData).join("text").attr("class", "volume-label")
        .attr("x", d => x(d.count) + 5).attr("y", d => y(d.path) + y.bandwidth() / 2 + 4)
        .attr("font-size", "12px").attr("font-weight", "bold").attr("fill", "#333")
        .text(d => d.count + " events");

    svg.append("g").attr("transform", `translate(0,${innerH})`).call(d3.axisBottom(x).ticks(5).tickFormat(d3.format("d")));
    svg.append("g").call(d3.axisLeft(y).tickSizeOuter(0));
}
