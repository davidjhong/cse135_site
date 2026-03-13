window.drawReliabilityDashboard = function(events) {
    // ==========================================
    // CENTRALIZED COLOR PALETTE FOR ALL CHARTS
    // ==========================================
    const FAILURE_TYPES = ['404 Not Found', 'Broken Asset', 'API Failure', 'Runtime JS Error'];
    const FAILURE_COLORS = {
        '404 Not Found': '#dc3545',      // Red (error/danger)
        'Broken Asset': '#fd7e14',       // Orange (warning/attention)
        'API Failure': '#0099cc',        // Blue (info/network)
        'Runtime JS Error': '#6c757d'    // Gray (technical/debug)
    };

    // ==========================================
    // FAILURE EVENT NORMALIZATION
    // ==========================================
    
    const normalizedFailures = [];
    const failureTypeMapping = {
        '404_not_found': '404 Not Found',
        'broken_asset': 'Broken Asset',
        'api_failure': 'API Failure',
        'runtime_error': 'Runtime JS Error'
    };

    for (const event of events) {
        if (!event.raw_data) continue;

        const timestamp = new Date(event.created_at);
        const pagePath = extractPagePath(event.url || '');
        let failureRecords = [];

        // Parse activities array if present
        if (event.raw_data.activities && Array.isArray(event.raw_data.activities)) {
            for (const activity of event.raw_data.activities) {
                const record = normalizeActivity(activity, pagePath, timestamp);
                if (record) failureRecords.push(record);
            }
        }

        // Handle page-level activities
        if (event.raw_data.type) {
            const record = normalizeEvent(event, pagePath, timestamp);
            if (record) failureRecords.push(record);
        }

        normalizedFailures.push(...failureRecords);
    }

    // ==========================================
    // AGGREGATION & ANALYSIS
    // ==========================================

    const failuresByType = new Map();
    const failuresByPage = new Map();
    const failuresByUrl = new Map();
    
    // Initialize counters
    FAILURE_TYPES.forEach(type => {
        failuresByType.set(type, 0);
    });

    // Aggregate failures
    for (const failure of normalizedFailures) {
        const type = failure.failureType;

        // Count by type
        if (failuresByType.has(type)) {
            failuresByType.set(type, failuresByType.get(type) + 1);
        }

        // Count by page and type
        const pageKey = failure.pagePath || '/';
        if (!failuresByPage.has(pageKey)) {
            failuresByPage.set(pageKey, new Map());
        }
        const pageTypes = failuresByPage.get(pageKey);
        pageTypes.set(type, (pageTypes.get(type) || 0) + 1);

        // Count by URL
        if (failure.target) {
            const urlKey = `${failure.target}|${type}`;
            failuresByUrl.set(urlKey, (failuresByUrl.get(urlKey) || 0) + 1);
        }
    }

    // Initialize missing types for all pages
    failuresByPage.forEach((pageTypes) => {
        FAILURE_TYPES.forEach(type => {
            if (!pageTypes.has(type)) {
                pageTypes.set(type, 0);
            }
        });
    });

    // Draw charts if data exists
    if (normalizedFailures.length > 0) {
        drawFailureTypeChart(failuresByType, FAILURE_COLORS);
        drawFailureByPageChart(failuresByPage, FAILURE_COLORS, FAILURE_TYPES);
        drawTopBrokenUrlsChart(failuresByUrl, normalizedFailures, FAILURE_COLORS);
    }
};

// ==========================================
// HELPERS: EVENT NORMALIZATION
// ==========================================

function extractPagePath(url) {
    try {
        const urlObj = new URL(url, window.location.origin);
        return urlObj.pathname || '/';
    } catch (e) {
        return '/';
    }
}

function normalizeActivity(activity, pagePath, timestamp) {
    if (!activity.type) return null;

    const type = activity.type;

    if (type === 'runtime_error') {
        return {
            timestamp: activity.timestamp || timestamp,
            pagePath: pagePath,
            failureType: 'Runtime JS Error',
            target: activity.filename || 'unknown',
            statusCode: null,
            message: activity.message || '',
            errorType: activity.errorType || 'Error',
            sourceEventType: 'runtime_error'
        };
    }

    if (type === 'broken_asset') {
        return {
            timestamp: activity.timestamp || timestamp,
            pagePath: pagePath,
            failureType: 'Broken Asset',
            target: activity.url || 'unknown',
            resourceType: activity.resourceType || 'unknown',
            statusCode: activity.statusCode || 0,
            message: `Failed to load ${activity.resourceType || 'asset'}`,
            sourceEventType: 'broken_asset'
        };
    }

    if (type === 'api_failure') {
        const failureType = activity.failureType === '404_not_found' ? '404 Not Found' : 'API Failure';
        return {
            timestamp: activity.timestamp || timestamp,
            pagePath: pagePath,
            failureType: failureType,
            target: activity.url || 'unknown',
            method: activity.method || 'GET',
            statusCode: activity.statusCode || 0,
            message: activity.statusText || 'API Request Failed',
            sourceEventType: 'api_failure'
        };
    }

    return null;
}

function normalizeEvent(event, pagePath, timestamp) {
    // Handle page-level failures if needed
    return null;
}

// ==========================================
// CHART 1: Failure Events by Type
// ==========================================

function drawFailureTypeChart(failuresByType, colorMap) {
    const container = d3.select("#reliability-type-chart");
    if (container.empty()) return;

    container.html("").style("position", "relative");

    const data = Array.from(failuresByType.entries())
        .filter(([type, count]) => count > 0)
        .map(([type, count]) => ({
            type: type,
            count: count
        }))
        .sort((a, b) => b.count - a.count);

    if (data.length === 0) {
        container.append("div")
            .attr("class", "chart-empty-state")
            .text("No failure events detected");
        return;
    }

    const totalFailures = data.reduce((sum, d) => sum + d.count, 0);

    const width = Math.max(container.node().getBoundingClientRect().width || 500, 500);
    const height = 300;
    const margin = { top: 50, right: 30, bottom: 30, left: 140 };  // Increased from 60 to 140
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("width", width)
        .attr("height", height)
        .style("max-width", "100%")
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    container.insert("div", ":first-child")
        .attr("class", "chart-title")
        .text("Failure Events by Type");
    
    container.insert("p", "div + div")
        .attr("class", "chart-subtitle")
        .html(`Total failures: ${totalFailures}`);

    const x = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.count) * 1.1])
        .range([0, innerW]);

    const y = d3.scaleBand()
        .domain(data.map(d => d.type))
        .range([0, innerH])
        .padding(0.3);

    const tooltip = container.append("div")
        .attr("class", "chart-tooltip")
        .style("opacity", 0);

    // Bars - color by failure type using centralized palette
    const bars = svg.selectAll("rect.failure-bar")
        .data(data)
        .join("rect")
        .attr("class", "failure-bar")
        .attr("x", 0)
        .attr("y", d => y(d.type))
        .attr("width", d => x(d.count))
        .attr("height", y.bandwidth())
        .attr("fill", d => colorMap[d.type] || '#999')
        .style("cursor", "pointer")
        .on("mouseover", function(event, d) {
            d3.select(this).attr("opacity", 0.85);
            const percentage = ((d.count / totalFailures) * 100).toFixed(1);
            tooltip.style("opacity", 1)
                .html(`<div class="chart-tooltip-heading">${d.type}</div>
                       <div>Count: ${d.count}</div>
                       <div>% of total: ${percentage}%</div>`);
        })
        .on("mousemove", (event) => {
            tooltip.style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).attr("opacity", 1);
            tooltip.style("opacity", 0);
        });

    // Value labels
    svg.selectAll("text.failure-label")
        .data(data)
        .join("text")
        .attr("class", "failure-label")
        .attr("x", d => x(d.count) + 5)
        .attr("y", d => y(d.type) + y.bandwidth() / 2)
        .attr("dy", "0.35em")
        .attr("font-size", "14px")
        .attr("fill", "#333")
        .text(d => d.count);

    // Axes
    svg.append("g")
        .attr("transform", `translate(0,${innerH})`)
        .call(d3.axisBottom(x).ticks(5))
        .append("text")
        .attr("x", innerW / 2)
        .attr("y", 30)
        .attr("fill", "#666")
        .attr("font-size", "12px")
        .text("Failure Count");

    svg.append("g")
        .call(d3.axisLeft(y).tickSizeOuter(0));
}

// ==========================================
// CHART 2: Failure Events by Page
// ==========================================

function drawFailureByPageChart(failuresByPage, colorMap, failureTypes) {
    const container = d3.select("#reliability-page-chart");
    if (container.empty()) return;

    container.html("").style("position", "relative");

    // Build data with all failure types per page
    const pageData = Array.from(failuresByPage.entries())
        .map(([page, typeMap]) => {
            const total = failureTypes.reduce((sum, type) => sum + (typeMap.get(type) || 0), 0);
            return {
                page: page,
                total: total,
                ...Object.fromEntries(failureTypes.map(type => [type, typeMap.get(type) || 0]))
            };
        })
        .filter(d => d.total > 0)
        .sort((a, b) => b.total - a.total);

    if (pageData.length === 0) {
        container.append("div")
            .attr("class", "chart-empty-state")
            .text("No page failures detected");
        return;
    }

    const width = Math.max(container.node().getBoundingClientRect().width || 500, 500);
    // Dynamically adjust height based on number of pages: 35px per page, min 250px
    const height = Math.max(250, 80 + pageData.length * 40);
    const margin = { top: 50, right: 30, bottom: 40, left: 180 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("width", width)
        .attr("height", height)
        .style("max-width", "100%")
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    container.insert("div", ":first-child")
        .attr("class", "chart-title")
        .text("Failure Events by Page");
    
    container.insert("p", "div + div")
        .attr("class", "chart-subtitle")
        .html("Stacked by failure type");

    const x = d3.scaleLinear()
        .domain([0, d3.max(pageData, d => d.total) * 1.1])
        .range([0, innerW]);

    const y = d3.scaleBand()
        .domain(pageData.map(d => d.page))
        .range([0, innerH])
        .padding(0.25);

    const tooltip = container.append("div")
        .attr("class", "chart-tooltip")
        .style("opacity", 0);

    // Stacked bars - using centralized color map
    const stack = d3.stack()
        .keys(failureTypes);

    const stackedData = stack(pageData);

    svg.selectAll("g.failure-type-group")
        .data(stackedData)
        .join("g")
        .attr("class", "failure-type-group")
        .attr("fill", d => colorMap[d.key] || '#999')
        .selectAll("rect")
        .data(d => d)
        .join("rect")
        .attr("y", d => y(d.data.page))
        .attr("x", d => x(d[0]))
        .attr("width", d => x(d[1]) - x(d[0]))
        .attr("height", y.bandwidth())
        .style("stroke", "white")
        .style("stroke-width", "1px")
        .style("cursor", "pointer")
        .on("mouseover", function(event, d) {
            const failureType = d3.select(this.parentNode).datum().key;
            const count = d[1] - d[0];
            const percentage = ((count / d.data.total) * 100).toFixed(1);
            
            tooltip.style("opacity", 1)
                .html(`<div class="chart-tooltip-heading">${d.data.page}</div>
                       <div>${failureType}</div>
                       <div>Count: ${count}</div>
                       <div>% of page: ${percentage}%</div>`);
        })
        .on("mousemove", (event) => {
            tooltip.style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function() {
            tooltip.style("opacity", 0);
        });

    // Legend
    const legendY = -35;
    const legendX = innerW - 380;
    
    svg.selectAll("circle.legend-dot")
        .data(failureTypes)
        .join("circle")
        .attr("class", "legend-dot")
        .attr("cx", (d, i) => legendX + (i % 2) * 180)
        .attr("cy", (d, i) => legendY + Math.floor(i / 2) * 15)
        .attr("r", 4)
        .attr("fill", d => colorMap[d] || '#999');

    svg.selectAll("text.legend-text")
        .data(failureTypes)
        .join("text")
        .attr("class", "legend-text")
        .attr("x", (d, i) => legendX + 12 + (i % 2) * 180)
        .attr("y", (d, i) => legendY + 4 + Math.floor(i / 2) * 15)
        .attr("font-size", "11px")
        .text(d => d);

    // Axes
    svg.append("g")
        .attr("transform", `translate(0,${innerH})`)
        .call(d3.axisBottom(x).ticks(4));

    svg.append("g")
        .call(d3.axisLeft(y).tickSizeOuter(0));
}

// ==========================================
// UTILITY: Smart URL Truncation
// ==========================================

function smartTruncateUrl(url, maxLength) {
    if (url.length <= maxLength) return url;
    
    try {
        const urlObj = new URL(url);
        const domain = urlObj.hostname;
        const path = urlObj.pathname;
        
        // Try to show domain + key path segment
        if (domain.length > maxLength) {
            return domain.substring(0, maxLength - 3) + '...';
        }
        
        const remaining = maxLength - domain.length - 1;  // -1 for separator
        if (remaining > 5) {
            const availablePathLength = remaining - 3;  // Reserve 3 for '...'
            return domain + '/' + path.substring(0, availablePathLength) + '...';
        }
        
        return domain + '/...';
    } catch (e) {
        // Fallback: simple truncation from end
        return url.substring(0, maxLength - 3) + '...';
    }
}

// ==========================================
// CHART 3: Top Broken URLs / Assets
// ==========================================

function drawTopBrokenUrlsChart(failuresByUrl, allFailures, colorMap) {
    const container = d3.select("#reliability-urls-chart");
    if (container.empty()) return;

    container.html("").style("position", "relative");

    // Build data with url and type info
    const urlMap = new Map();

    for (const failure of allFailures) {
        if (!failure.target) continue;
        
        if (!urlMap.has(failure.target)) {
            urlMap.set(failure.target, {
                url: failure.target,
                count: 0,
                types: new Map(),
                pages: new Set()
            });
        }

        const entry = urlMap.get(failure.target);
        entry.count += 1;
        entry.types.set(failure.failureType, (entry.types.get(failure.failureType) || 0) + 1);
        entry.pages.add(failure.pagePath);
    }

    // Convert to array and sort
    const topUrls = Array.from(urlMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

    if (topUrls.length === 0) {
        container.append("div")
            .attr("class", "chart-empty-state")
            .text("No broken URLs detected");
        return;
    }

    const width = Math.max(container.node().getBoundingClientRect().width || 500, 500);
    const height = 60 + topUrls.length * 35;
    const margin = { top: 50, right: 30, bottom: 40, left: 240 };  // Increased for longer labels
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = container.append("svg")
        .attr("width", width)
        .attr("height", height)
        .style("max-width", "100%")
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    container.insert("div", ":first-child")
        .attr("class", "chart-title")
        .text("Top Broken URLs / Assets");
    
    container.insert("p", "div + div")
        .attr("class", "chart-subtitle")
        .html(`Top ${topUrls.length} most frequently broken resources`);

    const x = d3.scaleLinear()
        .domain([0, d3.max(topUrls, d => d.count) * 1.1])
        .range([0, innerW]);

    const y = d3.scaleBand()
        .domain(topUrls.map((d, i) => i))
        .range([0, innerH])
        .padding(0.25);

    const tooltip = container.append("div")
        .attr("class", "chart-tooltip")
        .style("opacity", 0)
        .style("max-width", "320px");

    // Bars colored by dominant failure type
    svg.selectAll("rect.url-bar")
        .data(topUrls)
        .join("rect")
        .attr("class", "url-bar")
        .attr("x", 0)
        .attr("y", (d, i) => y(i))
        .attr("width", d => x(d.count))
        .attr("height", y.bandwidth())
        .attr("fill", d => {
            // Color by most common failure type for this URL
            let maxType = '404 Not Found';
            let maxCount = 0;
            d.types.forEach((count, type) => {
                if (count > maxCount) {
                    maxCount = count;
                    maxType = type;
                }
            });
            return colorMap[maxType] || '#999';
        })
        .style("cursor", "pointer")
        .on("mouseover", function(event, d) {
            d3.select(this).attr("opacity", 0.85);
            
            const typesList = Array.from(d.types.entries())
                .map(([type, count]) => `${type}: ${count}`)
                .join('<br/>');

            tooltip.style("opacity", 1)
                .html(`<div class="chart-tooltip-heading" style="word-break: break-word; margin-bottom: 8px;">
                       <strong>${d.url}</strong>
                       </div>
                       <div style="margin-bottom: 6px;">Total Failures: <strong>${d.count}</strong></div>
                       <div style="border-top: 1px solid #999; padding-top: 6px; margin-top: 6px; font-size: 11px;">${typesList}</div>`);
        })
        .on("mousemove", (event) => {
            tooltip.style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).attr("opacity", 1);
            tooltip.style("opacity", 0);
        });

    // URL labels - smart truncation
    svg.selectAll("text.url-label")
        .data(topUrls)
        .join("text")
        .attr("class", "url-label")
        .attr("x", -8)
        .attr("y", (d, i) => y(i) + y.bandwidth() / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "end")
        .attr("font-size", "11px")
        .attr("fill", "#333")
        .text(d => smartTruncateUrl(d.url, 40))
        .style("cursor", "pointer")
        .on("mouseover", function() {
            d3.select(this).attr("fill", "#0056b3");
        })
        .on("mouseout", function() {
            d3.select(this).attr("fill", "#333");
        });

    // Count labels
    svg.selectAll("text.count-label")
        .data(topUrls)
        .join("text")
        .attr("class", "count-label")
        .attr("x", d => x(d.count) + 5)
        .attr("y", (d, i) => y(i) + y.bandwidth() / 2)
        .attr("dy", "0.35em")
        .attr("font-size", "12px")
        .attr("fill", "#333")
        .text(d => d.count);

    // Axes
    svg.append("g")
        .attr("transform", `translate(0,${innerH})`)
        .call(d3.axisBottom(x).ticks(4));
}
