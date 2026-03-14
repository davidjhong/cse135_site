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
    // PAGE BUCKET NORMALIZATION (SHARED WITH LOAD ANALYTICS)
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
    function normalizePagePathForFailures(rawPath) {
        if (!rawPath) return '404';
        
        // Remove query params and hash first
        const cleanPath = rawPath.split('?')[0].split('#')[0];
        
        // Try exact match
        if (VALID_PAGES.has(cleanPath)) {
            return PAGE_LABELS[cleanPath] || cleanPath;
        }
        
        // Try without trailing slash
        const trimmedPath = cleanPath.replace(/\/$/, '');
        if (VALID_PAGES.has(trimmedPath)) {
            return PAGE_LABELS[trimmedPath] || trimmedPath;
        }
        
        // Try with trailing slash added
        const withSlash = cleanPath.endsWith('/') ? cleanPath : cleanPath + '/';
        if (VALID_PAGES.has(withSlash)) {
            return PAGE_LABELS[withSlash] || withSlash;
        }
        
        // If path doesn't match a known valid route, normalize to 404
        return '404';
    }

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

    // Debug: Track page path extraction
    const pagePathDebug = new Map();

    for (const event of events) {
        if (!event.raw_data) continue;

        const timestamp = new Date(event.created_at);
        
        // CRITICAL FIX: Extract page path from payload, not top-level event
        // Fallback chain: raw_data.url (primary) -> event.url -> other fields
        const pageUrl = 
            event.raw_data?.url ||          // Primary: page URL from payload
            event.url ||                    // Fallback: top-level event URL
            event.raw_data?.pageUrl ||
            event.raw_data?.currentUrl ||
            event.raw_data?.pathname ||
            '';
        
        const pagePath = extractPagePath(pageUrl);
        
        // Increment debug counter
        pagePathDebug.set(pagePath, (pagePathDebug.get(pagePath) || 0) + 1);
        
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

        // Count by page and type (normalized)
        const rawPagePath = failure.pagePath || '/';
        const normalizedPageLabel = normalizePagePathForFailures(rawPagePath);
        if (!failuresByPage.has(normalizedPageLabel)) {
            failuresByPage.set(normalizedPageLabel, new Map());
        }
        const pageTypes = failuresByPage.get(normalizedPageLabel);
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

    // Log debug info
    if (normalizedFailures.length === 0) {
        console.warn("[Reliability Dashboard] No failures normalized. Events received:", events.length);
        console.warn("[Reliability Dashboard] Sample event URLs:", events.slice(0, 3).map(e => ({
            'event.url': e.url,
            'raw_data.url': e.raw_data?.url,
            'raw_data.type': e.raw_data?.type
        })));
        console.warn("[Reliability Dashboard] Page paths extracted:", Array.from(pagePathDebug.entries()));
        
        // Check if raw_data has activities at all
        const eventsWithActivities = events.filter(e => e.raw_data && e.raw_data.activities).length;
        console.warn("[Reliability Dashboard] Events with activities:", eventsWithActivities);
        
        // Sample some activities
        for (const event of events.slice(0, 5)) {
            if (event.raw_data?.activities?.length > 0) {
                console.log("[Reliability Dashboard] Sample activities from event:", {
                    'event.raw_data.url': event.raw_data.url,
                    'activity count': event.raw_data.activities.length,
                    'activity types': event.raw_data.activities.map(a => a.type)
                });
            }
        }
    } else {
        console.log("[Reliability Dashboard] ✓ Normalized failures:", normalizedFailures.length);
        console.log("[Reliability Dashboard] ✓ Failures by type:", Array.from(failuresByType.entries()));
        console.log("[Reliability Dashboard] ✓ Failures by page (NORMALIZED LABELS):", Array.from(failuresByPage.keys()).sort());
        console.log("[Reliability Dashboard] ✓ Unique pages detected:", failuresByPage.size);
        console.log("[Reliability Dashboard] ✓ Page normalization: Invalid/malformed paths aggregated into 404 bucket");
        
        // Sample normalized records showing pagePath vs target separation
        console.log("[Reliability Dashboard] Sample normalized failures (pagePath vs target):");
        for (const failure of normalizedFailures.slice(0, 5)) {
            console.log({
                'pagePath (where failure happened)': failure.pagePath,
                'target (what failed)': failure.target,
                'failureType': failure.failureType,
                'sourceKind': failure.sourceKind,
                'sourceEventType': failure.sourceEventType
            });
        }
    }

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
    // Robust page path extraction with fallback logic
    if (!url) return '/';
    
    try {
        const urlObj = new URL(url, window.location.origin);
        let pathname = urlObj.pathname || '/';
        
        // Normalize common patterns
        if (pathname === '/' || pathname === '/index.html' || pathname === '/index.php') {
            return '/';
        }
        
        // Remove trailing slashes and query strings
        pathname = pathname.replace(/\/$/, ''); // Remove trailing slash
        pathname = pathname.split('?')[0].split('#')[0]; // Remove query/fragment

        // Preserve meaningful path segments
        // Examples: /products.html, /product-detail.html, /checkout.html, /test/products.html
        return pathname || '/';
    } catch (e) {
        // Fallback: try parsing as relative URL
        try {
            let path = url;
            if (path.startsWith('http')) {
                path = new URL(url).pathname;
            } else if (path.startsWith('/')) {
                // Already a path
            } else {
                path = '/' + path;
            }
            path = path.replace(/\/$/, '').split('?')[0].split('#')[0];
            return path || '/';
        } catch (e2) {
            return '/';
        }
    }
}

function normalizeActivity(activity, pagePath, timestamp) {
    if (!activity.type) return null;

    const type = activity.type;

    if (type === 'runtime_error') {
        return {
            timestamp: activity.timestamp || timestamp,
            pagePath: pagePath,                              // Page where error occurred
            failureType: 'Runtime JS Error',
            target: activity.filename || 'unknown',          // File that errored
            statusCode: null,
            message: activity.message || '',
            errorType: activity.errorType || 'Error',
            sourceEventType: 'runtime_error',
            sourceKind: 'RuntimeJS'                          // Optional: source classification
        };
    }

    if (type === 'broken_asset') {
        return {
            timestamp: activity.timestamp || timestamp,
            pagePath: pagePath,                              // Page where asset was requested
            failureType: 'Broken Asset',
            target: activity.url || 'unknown',               // Asset URL that failed
            resourceType: activity.resourceType || 'unknown',
            statusCode: activity.statusCode || 0,
            message: `Failed to load ${activity.resourceType || 'asset'}`,
            sourceEventType: 'broken_asset',
            sourceKind: 'Asset'                              // Optional: source classification
        };
    }

    if (type === 'api_failure') {
        // Keep API 404s as "404 Not Found" - do not reclassify as "API Failure"
        const failureType = activity.failureType === '404_not_found' 
            ? '404 Not Found' 
            : 'API Failure';
        
        return {
            timestamp: activity.timestamp || timestamp,
            pagePath: pagePath,                              // Page where API was called
            failureType: failureType,
            target: activity.url || 'unknown',               // API endpoint that failed
            method: activity.method || 'GET',
            statusCode: activity.statusCode || 0,
            message: activity.statusText || 'API Request Failed',
            sourceEventType: 'api_failure',
            sourceKind: 'API'                                // Optional: source classification
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
            d3.select(this).attr("opacity", 1);
            const percentage = ((d.count / totalFailures) * 100).toFixed(1);
            tooltip.style("opacity", 1)
                .html(`<div style="font-weight: bold; margin-bottom: 6px;">${d.type}</div>
                       <div style="margin-bottom: 4px;">
                           <div style="font-weight: 600; color: ${colorMap[d.type] || '#999'};">Count: ${d.count}</div>
                           <div style="font-size: 11px; color: #ccc; margin-top: 2px;">${percentage}% of total failures</div>
                       </div>`);
        })
        .on("mousemove", (event) => {
            const [xPos, yPos] = d3.pointer(event, container.node());
            tooltip.style("left", (xPos + 15) + "px")
                .style("top", (yPos - 28) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).attr("opacity", 0.85);
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
        .attr("opacity", 0.85)
        .on("mouseover", function(event, d) {
            d3.select(this).attr("opacity", 1);
            const failureType = d3.select(this.parentNode).datum().key;
            const count = Math.round(d[1] - d[0]);
            const percentage = ((count / d.data.total) * 100).toFixed(1);
            
            tooltip.style("opacity", 1)
                .html(`<div style="font-weight: bold; margin-bottom: 6px;">${d.data.page}</div>
                       <div style="margin-bottom: 4px;">
                           <div style="font-weight: 600; color: ${colorMap[failureType] || '#999'};">${failureType}</div>
                           <div style="font-size: 11px; color: #ccc; margin-top: 2px;">${count} failures (${percentage}% of page failures)</div>
                       </div>
                       <div style="border-top: 1px solid #666; padding-top: 4px; margin-top: 6px; font-size: 11px; color: #aaa;">
                           Total on page: ${d.data.total} failures
                       </div>`);
        })
        .on("mousemove", (event) => {
            const [xPos, yPos] = d3.pointer(event, container.node());
            tooltip.style("left", (xPos + 15) + "px")
                .style("top", (yPos - 28) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).attr("opacity", 0.85);
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
// UTILITY: URL Label Formatting for Display
// ==========================================

function formatUrlLabel(url, maxLength = 40) {
    // Format URL for display: prefer hostname + path segment over raw string
    if (!url) return 'unknown';
    if (url.length <= maxLength) return url;
    
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname || 'unknown';
        const pathname = urlObj.pathname || '';
        
        // Strategy 1: Try hostname + path
        if (hostname.length < maxLength - 5) {
            // We have room for path
            const availablePathLength = maxLength - hostname.length - 4; // -4 for "/ ..."
            if (pathname.length > availablePathLength) {
                // Truncate path intelligently
                if (pathname.includes('/')) {
                    const segments = pathname.split('/').filter(s => s);
                    let path = '';
                    for (const seg of segments) {
                        if ((path + '/' + seg).length + 3 <= availablePathLength) {
                            path += '/' + seg;
                        } else {
                            path += '/...';
                            break;
                        }
                    }
                    return hostname + path;
                } else {
                    return hostname + pathname.substring(0, availablePathLength) + '...';
                }
            } else {
                return hostname + pathname;
            }
        } else {
            // Hostname alone is long, truncate it
            return hostname.substring(0, maxLength - 3) + '...';
        }
    } catch (e) {
        // Not a valid URL, do simple truncation
        return url.substring(0, maxLength - 3) + '...';
    }
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

    // Build comprehensive URL data with all failure context
    const urlDetailMap = new Map();

    for (const failure of allFailures) {
        if (!failure.target) continue;
        
        const urlKey = failure.target;
        if (!urlDetailMap.has(urlKey)) {
            urlDetailMap.set(urlKey, {
                url: failure.target,
                count: 0,
                types: new Map(),
                pages: new Set(),
                messages: []
            });
        }

        const entry = urlDetailMap.get(urlKey);
        entry.count += 1;
        entry.types.set(failure.failureType, (entry.types.get(failure.failureType) || 0) + 1);
        entry.pages.add(failure.pagePath || '/');
        if (failure.message && entry.messages.length < 3) {
            entry.messages.push(failure.message);
        }
    }

    // Convert to array and sort by count
    const topUrls = Array.from(urlDetailMap.values())
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
    const margin = { top: 50, right: 30, bottom: 40, left: 260 };  // Increased for readable labels
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
        .text("Top Failure Targets");
    
    container.insert("p", "div + div")
        .attr("class", "chart-subtitle")
        .html(`Resources, endpoints, and files most frequently involved in client failures`);

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
        .style("position", "absolute")
        .style("pointer-events", "none")
        .style("z-index", "100")
        .style("max-width", "340px");

    // Convert topUrls to stacked format - similar to Chart 2
    const FAILURE_TYPES = ['404 Not Found', 'Broken Asset', 'API Failure', 'Runtime JS Error'];
    
    // Build data structure for stacking
    const urlStackData = topUrls.map(d => ({
        url: d.url,
        pages: d.pages,
        total: d.count,
        ...Object.fromEntries(FAILURE_TYPES.map(type => [type, d.types.get(type) || 0]))
    }));

    // Stacked bars - color by failure type
    const stack = d3.stack().keys(FAILURE_TYPES);
    const stackedUrlData = stack(urlStackData);

    svg.selectAll("g.url-type-group")
        .data(stackedUrlData)
        .join("g")
        .attr("class", "url-type-group")
        .attr("fill", d => colorMap[d.key] || '#999')
        .selectAll("rect")
        .data(d => d)
        .join("rect")
        .attr("y", (d, i) => y(i))
        .attr("x", d => x(d[0]))
        .attr("width", d => x(d[1]) - x(d[0]))
        .attr("height", y.bandwidth())
        .style("stroke", "white")
        .style("stroke-width", "1px")
        .style("cursor", "pointer")
        .attr("opacity", 0.85)
        .on("mouseover", function(event, d) {
            d3.select(this).attr("stroke", "#333").attr("stroke-width", "2px").attr("opacity", 1);
            const failureType = d3.select(this.parentNode).datum().key;
            const count = Math.round(d[1] - d[0]);
            const urlData = d.data;  // Access original data from stacked structure
            const percentage = ((count / urlData.total) * 100).toFixed(1);
            
            // Build type breakdown
            const typesList = FAILURE_TYPES
                .filter(type => urlData[type] > 0)
                .map(type => {
                    const typeCount = urlData[type];
                    const typePct = ((typeCount / urlData.total) * 100).toFixed(0);
                    return `<span style="color: ${colorMap[type] || '#999'};">●</span> ${type}: ${typeCount} (${typePct}%)`;
                })
                .join('<br/>');

            // Build page context
            const pageContext = urlData.pages.size > 1 
                ? `Seen on ${urlData.pages.size} pages` 
                : `Page: ${Array.from(urlData.pages)[0] || '/'}`;

            tooltip.style("opacity", 1)
                .style("background", "#1a1a1a")
                .style("border", "1px solid #444")
                .style("border-radius", "4px")
                .style("padding", "10px")
                .style("color", "#fff")
                .html(`<div style="font-weight: bold; margin-bottom: 6px; word-break: break-word; border-bottom: 1px solid #666; padding-bottom: 4px;">
                           ${urlData.url}
                       </div>
                       <div style="margin-bottom: 6px; font-size: 12px; color: #66ccff; font-weight: 600;">
                           Total Failures: ${urlData.total}
                       </div>
                       <div style="margin-bottom: 4px; font-size: 11px;">
                           ${typesList}
                       </div>
                       <div style="border-top: 1px solid #666; padding-top: 4px; margin-top: 6px; font-size: 11px; color: #aaa;">
                           ${pageContext}
                       </div>`);
        })
        .on("mousemove", (event) => {
            const [xPos, yPos] = d3.pointer(event, container.node());
            tooltip.style("left", (xPos + 15) + "px")
                .style("top", (yPos - 28) + "px");
        })
        .on("mouseout", function() {
            d3.select(this).attr("stroke", "white").attr("stroke-width", "1px").attr("opacity", 0.85);
            tooltip.style("opacity", 0);
        });

    // URL labels - using cleaned display labels
    svg.selectAll("text.url-label")
        .data(urlStackData)
        .join("text")
        .attr("class", "url-label")
        .attr("x", -8)
        .attr("y", (d, i) => y(i) + y.bandwidth() / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "end")
        .attr("font-size", "11px")
        .attr("fill", "#333")
        .text(d => formatUrlLabel(d.url, 50))
        .style("cursor", "pointer")
        .on("mouseover", function() {
            d3.select(this).attr("fill", "#0056b3").attr("font-weight", "600");
        })
        .on("mouseout", function() {
            d3.select(this).attr("fill", "#333").attr("font-weight", "normal");
        });

    // Count labels - positioned at end of bar
    svg.selectAll("text.count-label")
        .data(urlStackData)
        .join("text")
        .attr("class", "count-label")
        .attr("x", d => x(d.total) + 5)
        .attr("y", (d, i) => y(i) + y.bandwidth() / 2)
        .attr("dy", "0.35em")
        .attr("font-size", "12px")
        .attr("fill", "#333")
        .attr("font-weight", "600")
        .text(d => d.total);

    // Legend
    const legendY = -35;
    const legendX = Math.max(0, innerW - 380);
    
    svg.selectAll("circle.legend-dot-urls")
        .data(FAILURE_TYPES)
        .join("circle")
        .attr("class", "legend-dot-urls")
        .attr("cx", (d, i) => legendX + (i % 2) * 180)
        .attr("cy", (d, i) => legendY + Math.floor(i / 2) * 15)
        .attr("r", 4)
        .attr("fill", d => colorMap[d] || '#999');

    svg.selectAll("text.legend-text-urls")
        .data(FAILURE_TYPES)
        .join("text")
        .attr("class", "legend-text-urls")
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
