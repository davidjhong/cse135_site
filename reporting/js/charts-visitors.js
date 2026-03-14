window.populateBehaviorKPIs = function(events) {
    const analyticsUtils = window.AnalyticsUtils || {};
    const getEventPageLabel = typeof analyticsUtils.getEventPageLabel === 'function'
        ? analyticsUtils.getEventPageLabel
        : (() => null);

    const visitsEl = d3.select("#behavior-kpi-visits");
    const visitsSubEl = d3.select("#behavior-kpi-visits-sub");
    const pagesEl = d3.select("#behavior-kpi-pages");
    const pagesSubEl = d3.select("#behavior-kpi-pages-sub");
    const interactionsEl = d3.select("#behavior-kpi-interactions");
    const interactionsSubEl = d3.select("#behavior-kpi-interactions-sub");

    if (visitsEl.empty() || pagesEl.empty() || interactionsEl.empty()) return;

    const sourceEvents = Array.isArray(events) ? events : [];
    const pageLoadEvents = sourceEvents.filter(ev => ev.event_type === 'page_load' && ev.session_id);

    const sessions = new Set();
    const users = new Set();
    const pageviewsBySession = new Map();
    let totalPageviews = 0;

    pageLoadEvents.forEach(ev => {
        const sessionId = ev.session_id;
        const pageLabel = getEventPageLabel(ev);
        if (!sessionId || !pageLabel) return;

        sessions.add(sessionId);
        totalPageviews++;

        const userToken = ev.raw_data?.user_id || ev.user_id || ev.session_id;
        if (userToken) users.add(userToken);

        if (!pageviewsBySession.has(sessionId)) {
            pageviewsBySession.set(sessionId, 0);
        }
        pageviewsBySession.set(sessionId, pageviewsBySession.get(sessionId) + 1);
    });

    const totalVisits = sessions.size;

    if (totalVisits === 0) {
        visitsEl.text("-");
        visitsSubEl.text("No visit data in Last 30 Days");
        pagesEl.text("-");
        pagesSubEl.text("No visit data in Last 30 Days");
        interactionsEl.text("-");
        interactionsSubEl.text("No interaction data in Last 30 Days");
        return;
    }

    let singlePageSessions = 0;
    let multiPageSessions = 0;
    pageviewsBySession.forEach(count => {
        if (count === 1) singlePageSessions++;
        else if (count >= 2) multiPageSessions++;
    });

    let totalClicks = 0;
    let totalScrolls = 0;
    let totalKeyInputs = 0;

    sourceEvents.forEach(ev => {
        if ((ev.event_type !== 'activity_update' && ev.event_type !== 'page_exit') || !ev.raw_data?.activities) {
            return;
        }

        const activities = Array.isArray(ev.raw_data.activities) ? ev.raw_data.activities : [];
        activities.forEach(activity => {
            if (activity.type === 'click' || activity.type === 'mousedown') {
                totalClicks++;
            } else if (activity.type === 'scroll') {
                totalScrolls++;
            } else if (activity.type === 'keydown') {
                totalKeyInputs++;
            }
        });
    });

    const avgPagesPerVisit = totalPageviews / totalVisits;
    const avgClicksPerVisit = totalClicks / totalVisits;
    const avgScrollsPerVisit = totalScrolls / totalVisits;
    const avgKeyInputsPerVisit = totalKeyInputs / totalVisits;
    const avgInteractionsPerVisit = (totalClicks + totalScrolls + totalKeyInputs) / totalVisits;

    visitsEl.text(totalVisits);
    visitsSubEl.text(`${totalPageviews} pageviews · ${users.size} users (Last 30 Days)`);

    pagesEl.text(avgPagesPerVisit.toFixed(2));
    pagesSubEl.text(`${singlePageSessions} single-page sessions · ${multiPageSessions} multi-page sessions`);

    interactionsEl.text(avgInteractionsPerVisit.toFixed(2));
    interactionsSubEl.text(`${avgClicksPerVisit.toFixed(1)} clicks/visit · ${avgScrollsPerVisit.toFixed(1)} scrolls/visit · ${avgKeyInputsPerVisit.toFixed(1)} key inputs/visit`);
};

function drawTopPageTransitionsChart(events) {
    const chartContainer = d3.select("#most-visited-pages-chart");
    if (chartContainer.empty()) return;
    chartContainer.html("").style("position", "relative");
    const analyticsUtils = window.AnalyticsUtils || {};
    const extractPagePath = typeof analyticsUtils.getEventPageLabel === 'function'
        ? analyticsUtils.getEventPageLabel
        : (() => null);

    // ==========================================
    // BUILD PAGE TRANSITIONS BY SESSION
    // ==========================================
    
    const sessionPages = new Map();
    let processedCount = 0;

    // Group page_load events by session and sort by timestamp
    events.filter(d => d.event_type === 'page_load').forEach(ev => {
        const sessionId = ev.session_id;
        const normalizedPage = extractPagePath(ev);
        
        if (!normalizedPage) return;
        
        if (!sessionPages.has(sessionId)) {
            sessionPages.set(sessionId, []);
        }
        sessionPages.get(sessionId).push({
            page: normalizedPage,
            timestamp: ev.created_at || 0
        });
        processedCount++;
    });

    // Sort each session's pages by timestamp and build transitions
    const transitionCounts = new Map();
    let transitionCount = 0;

    sessionPages.forEach((pages, sessionId) => {
        // Sort by timestamp within session
        const sortedPages = pages.sort((a, b) => {
            const timeA = new Date(a.timestamp).getTime();
            const timeB = new Date(b.timestamp).getTime();
            return timeA - timeB;
        });

        // Build consecutive transitions (excluding self-transitions)
        for (let i = 0; i < sortedPages.length - 1; i++) {
            const source = sortedPages[i].page;
            const destination = sortedPages[i + 1].page;
            
            // Skip self-transitions (e.g., Home -> Home)
            if (source === destination) continue;
            
            const transitionLabel = `${source} → ${destination}`;
            transitionCounts.set(transitionLabel, (transitionCounts.get(transitionLabel) || 0) + 1);
            transitionCount++;
        }
    });

    console.log("[Top Page Transitions] ✓ Processed:", processedCount, "page load events");
    console.log("[Top Page Transitions] ✓ Built:", transitionCount, "total transitions");
    console.log("[Top Page Transitions] ✓ Unique transitions:", transitionCounts.size);

    // Sort transitions by frequency and get top 10
    const transitionData = Array.from(transitionCounts.entries())
        .map(([label, count]) => ({
            label,
            count,
            percentage: transitionCount > 0 ? ((count / transitionCount) * 100).toFixed(1) : 0,
            has404: label.includes('404')
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

    if (transitionData.length === 0) {
        chartContainer.html('<p class="chart-empty-state">No page transitions detected. Users may not be navigating between pages.</p>');
        return;
    }

    // Setup dimensions
    const width = Math.max(chartContainer.node().getBoundingClientRect().width || 450, 450);
    const height = Math.max(200, 60 + transitionData.length * 35);
    const margin = { top: 70, right: 30, bottom: 30, left: 180 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = chartContainer.append("svg")
        .attr("width", width)
        .attr("height", height)
        .style("max-width", "100%")
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    chartContainer.insert("div", ":first-child")
        .attr("class", "chart-title")
        .text("Top Page Transitions");
    
    chartContainer.insert("p", "div + div")
        .attr("class", "chart-subtitle")
        .html("Most common page-to-page paths across sessions (Last 30 Days)");

    // Scales
    const x = d3.scaleLinear()
        .domain([0, d3.max(transitionData, d => d.count) * 1.1])
        .range([0, innerW]);

    const y = d3.scaleBand()
        .domain(transitionData.map(d => d.label))
        .range([0, innerH])
        .padding(0.35);

    // Tooltip
    const tooltip = chartContainer.append("div")
        .attr("class", "chart-tooltip")
        .style("opacity", 0)
        .style("position", "absolute")
        .style("pointer-events", "none")
        .style("z-index", "100");

    // Bars
    svg.selectAll("rect.transition-bar")
        .data(transitionData)
        .join("rect")
        .attr("class", "transition-bar")
        .attr("x", 0)
        .attr("y", d => y(d.label))
        .attr("width", d => x(d.count))
        .attr("height", y.bandwidth())
        .attr("fill", d => {
            // Color by intensity, with special attention to 404 paths
            const intensity = d.count / d3.max(transitionData, p => p.count);
            if (d.has404) {
                return d3.interpolateReds(0.4 + intensity * 0.5);
            }
            return d3.interpolateBlues(0.4 + intensity * 0.5);
        })
        .style("cursor", "pointer")
        .attr("opacity", 0.85)
        .on("mouseover", function() {
            d3.select(this).attr("opacity", 1);
        })
        .on("mouseout", function() {
            d3.select(this).attr("opacity", 0.85);
            tooltip.style("opacity", 0);
        })
        .on("mousemove", function(event, d) {
            let tooltipContent = `
                <div style="font-weight: bold; margin-bottom: 6px;">${d.label}</div>
                <div style="margin-bottom: 4px;">
                    <div style="font-weight: 600;">Transitions: ${d.count}</div>
                    <div style="font-size: 11px; color: #ccc; margin-top: 2px;">${d.percentage}% of all transitions</div>
                </div>
            `;
            
            if (d.has404) {
                tooltipContent += `<div style="border-top: 1px solid #666; padding-top: 4px; margin-top: 6px; font-size: 11px; color: #ff9999;">⚠ Path includes 404 errors</div>`;
            }
            
            tooltip.style("opacity", 1).html(tooltipContent);
            
            const [xPos, yPos] = d3.pointer(event, chartContainer.node());
            let tipX = xPos + 15;
            if (tipX + 240 > window.innerWidth) tipX = xPos - 250;
            tooltip.style("left", `${tipX}px`).style("top", `${yPos - 28}px`);
        });

    // Value labels
    svg.selectAll("text.transition-label")
        .data(transitionData)
        .join("text")
        .attr("class", "transition-label")
        .attr("x", d => x(d.count) + 5)
        .attr("y", d => y(d.label) + y.bandwidth() / 2)
        .attr("dy", "0.35em")
        .attr("font-size", "12px")
        .attr("fill", "#333")
        .text(d => d.count);

    // Axes
    svg.append("g")
        .attr("transform", `translate(0,${innerH})`)
        .call(d3.axisBottom(x).ticks(4).tickFormat(d3.format("d")));

    svg.append("g")
        .call(d3.axisLeft(y).tickSizeOuter(0));
}

function drawDeviceCategoryChart(events) {
    const chartContainer = d3.select("#device-category-chart");
    if (chartContainer.empty()) return;
    chartContainer.html("");
    
    // 1. Extract unique visitors (sessions) and determine device category
    const sessions = new Map();
    events.filter(d => d.event_type === 'page_load' && d.raw_data?.static).forEach(ev => {
        if (!sessions.has(ev.session_id)) {
            const ua = ev.raw_data.static.userAgent || "";
            const w = ev.raw_data.static.screenWidth || window.innerWidth;
            let device = 'desktop';
            
            if (/mobile|iphone|ipod|android.*mobile/i.test(ua)) device = 'mobile';
            else if (w < 768) device = 'mobile';
            
            sessions.set(ev.session_id, device);
        }
    });

    const counts = { mobile: 0, desktop: 0 };
    sessions.forEach(device => { if (counts[device] !== undefined) counts[device]++; });
    
    const totalVisitors = sessions.size;
    const data = Object.entries(counts).filter(([, val]) => val > 0).map(([key, value]) => ({ key, value }));

    if (totalVisitors === 0) {
        chartContainer.html('<p class="chart-empty-state">No visitor data available.</p>');
        return;
    }

    // 2. Setup Dimensions & SVG
    const width = 450, height = 400, margin = 40;
    const radius = Math.min(width, height) / 2 - margin;

    const svg = chartContainer.append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", `translate(${width / 2},${height / 2 - 20})`);

    // Title
    chartContainer.insert("div", ":first-child")
        .attr("class", "chart-title chart-title-small")
        .text("Visit by device category");

    // 3. Colors & Generators
    const colorMap = {
        "mobile": "#61a9f3", 
        "desktop": "#ef7b05"
    };

    const pie = d3.pie().value(d => d.value).sort(null);
    const arc = d3.arc().innerRadius(radius * 0.6).outerRadius(radius);
    const outerArc = d3.arc().innerRadius(radius * 1.1).outerRadius(radius * 1.1);

    // Tooltip
    const tooltip = chartContainer.append("div")
        .attr("class", "chart-tooltip");

    // 4. Draw Slices
    svg.selectAll('allSlices')
        .data(pie(data))
        .enter()
        .append('path')
        .attr('d', arc)
        .attr('fill', d => colorMap[d.data.key])
        .attr('class', 'pie-slice')
        .on("mouseenter", function (event, d) {
            d3.select(this).style("opacity", 0.8);
            const percent = ((d.data.value / totalVisitors) * 100).toFixed(2);
            tooltip.style("opacity", 1)
                .html(`<div class="chart-tooltip-heading">${d.data.key}</div>
                       Visitors: ${d.data.value}<br>
                       Percent Value: ${percent}%`);
        })
        .on("mousemove", function (event) {
            const [mouseX, mouseY] = d3.pointer(event, chartContainer.node());
            tooltip.style("left", `${mouseX + 15}px`).style("top", `${mouseY}px`);
        })
        .on("mouseleave", function () {
            d3.select(this).style("opacity", 1);
            tooltip.style("opacity", 0);
        });

    // 5. Center Text
    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "-0.1em")
        .attr("class", "pie-center-number")
        .text(totalVisitors);

    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "1.5em")
        .attr("class", "pie-center-label")
        .text("Visitors");

    // 6. External Lines & Labels
    svg.selectAll('allPolylines')
        .data(pie(data))
        .enter()
        .append('polyline')
        .attr("class", "pie-polyline")
        .attr('points', function(d) {
            const posA = arc.centroid(d);
            const posB = outerArc.centroid(d);
            const posC = outerArc.centroid(d);
            const midangle = d.startAngle + (d.endAngle - d.startAngle) / 2;
            posC[0] = radius * 1.15 * (midangle < Math.PI ? 1 : -1);
            return [posA, posB, posC];
        });

    svg.selectAll('allLabels')
        .data(pie(data))
        .enter()
        .append('text')
        .text(d => d.data.value)
        .attr('transform', function(d) {
            const pos = outerArc.centroid(d);
            const midangle = d.startAngle + (d.endAngle - d.startAngle) / 2;
            pos[0] = radius * 1.2 * (midangle < Math.PI ? 1 : -1);
            return `translate(${pos})`;
        })
        .style('text-anchor', function(d) {
            const midangle = d.startAngle + (d.endAngle - d.startAngle) / 2;
            return (midangle < Math.PI ? 'start' : 'end');
        })
        .attr("class", "pie-label");

    // 7. Legend
    const legend = svg.append("g")
        .attr("transform", `translate(-${width/2.5}, ${height/2 - 5})`);
    
    let legendOffset = 0;
    const legendKeys = ["mobile", "desktop"];
    
    legendKeys.forEach(key => {
        const item = legend.append("g").attr("transform", `translate(${legendOffset}, 0)`);
        item.append("rect").attr("width", 12).attr("height", 12).attr("fill", colorMap[key]);
        item.append("text")
            .attr("x", 18)
            .attr("y", 10)
            .text(key)
            .attr("class", "pie-legend-text");
        legendOffset += 70 + (key.length * 5); 
    });
}

function drawVisitorTimelineChart(events) {
    const chartContainer = d3.select("#visitor-timeline-chart");
    if (chartContainer.empty()) return;
    chartContainer.html("");

    const dailyStats = new Map();
    const globalUsers = new Set();
    const globalSessions = new Set();

    // Aggregate daily Pageviews, Sessions, and Users
    events.filter(d => d.event_type === 'page_load').forEach(ev => {
        if (!ev.created_at) return;
        const dateKey = ev.created_at.split(' ')[0];
        
        // Legacy fallback: if user_id doesn't exist, use session_id
        const uid = ev.raw_data?.user_id || ev.session_id; 
        const sid = ev.session_id;

        if (!dailyStats.has(dateKey)) {
            dailyStats.set(dateKey, { 
                date: new Date(dateKey + 'T00:00:00'), 
                usersSet: new Set(),
                sessionsSet: new Set(),
                pageviews: 0 
            });
        }
        
        dailyStats.get(dateKey).usersSet.add(uid);
        dailyStats.get(dateKey).sessionsSet.add(sid);
        dailyStats.get(dateKey).pageviews++;

        // Add to global sets for accurate title totals
        globalUsers.add(uid);
        globalSessions.add(sid);
    });

    const data = Array.from(dailyStats.values()).map(stat => ({
        date: stat.date,
        pageviews: stat.pageviews,
        sessions: stat.sessionsSet.size,
        users: stat.usersSet.size
    })).sort((a, b) => a.date - b.date);

    if (data.length === 0) {
        chartContainer.html('<p class="chart-empty-state">No timeline data available.</p>');
        return;
    }

    const totalViews = d3.sum(data, d => d.pageviews);

    // 2. Setup Dimensions
    const width = 560, height = 350;
    const margin = {top: 70, right: 20, bottom: 30, left: 40};
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = chartContainer.append("svg")
        .attr("width", width).attr("height", height)
        .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // Top Title (Now mathematically perfect)
    chartContainer.insert("div", ":first-child")
        .attr("class", "chart-title")
        .text(`Traffic Overview`);

    chartContainer.insert("p", "div + div")
        .attr("class", "chart-subtitle")
        .html("Daily traffic trend across pageviews, visits, and unique users (Last 30 Days)");

    // Dynamic Legend Area
    const legendDiv = chartContainer.append("div")
        .attr("class", "timeline-legend")
        .style("left", `${margin.left}px`);

    const updateLegend = (d) => {
        if (!d) return;
        const dateStr = d3.timeFormat("%d %b %Y")(d.date);
        legendDiv.html(`
            <span class="legend-date">${dateStr}</span>
            <span class="legend-item"><span class="legend-color legend-pv"></span> Pageviews: ${d.pageviews}</span>
            <span class="legend-item"><span class="legend-color legend-vis"></span> Visits: ${d.sessions}</span>
            <span class="legend-item"><span class="legend-color legend-new"></span> Unique Users: ${d.users}</span>
        `);
    };
    updateLegend(data[data.length - 1]);

    const tooltip = chartContainer.append("div")
        .attr("class", "chart-tooltip");

    // 3. Scales
    const x = d3.scaleTime().domain(d3.extent(data, d => d.date)).range([0, innerWidth]);
    const yMax = Math.max(d3.max(data, d => d.pageviews) || 5, 5);
    const y = d3.scaleLinear().domain([0, yMax]).range([innerHeight, 0]);

    // 4. Area Generators
    const areaPageviews = d3.area().x(d => x(d.date)).y0(innerHeight).y1(d => y(d.pageviews)).curve(d3.curveMonotoneX);
    const areaSessions = d3.area().x(d => x(d.date)).y0(innerHeight).y1(d => y(d.sessions)).curve(d3.curveMonotoneX);
    const areaUsers = d3.area().x(d => x(d.date)).y0(innerHeight).y1(d => y(d.users)).curve(d3.curveMonotoneX);
    const linePageviews = d3.line().x(d => x(d.date)).y(d => y(d.pageviews)).curve(d3.curveMonotoneX);
    const lineSessions = d3.line().x(d => x(d.date)).y(d => y(d.sessions)).curve(d3.curveMonotoneX);
    const lineUsers = d3.line().x(d => x(d.date)).y(d => y(d.users)).curve(d3.curveMonotoneX);

    // Draw Areas
    svg.append("path").datum(data).attr("class", "area-pageviews").attr("d", areaPageviews);
    svg.append("path").datum(data).attr("class", "area-visitors").attr("d", areaSessions); // Light Blue = Visits
    svg.append("path").datum(data).attr("class", "area-new-visitors").attr("d", areaUsers); // Dark Blue = Unique Users

    // Draw lines on top of areas for clearer trend readability
    svg.append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", "#ced4da")
        .attr("stroke-width", 1.5)
        .attr("opacity", 0.95)
        .attr("d", linePageviews);

    svg.append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", "#7bb8f5")
        .attr("stroke-width", 2)
        .attr("opacity", 0.95)
        .attr("d", lineSessions);

    svg.append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", "#2880c8")
        .attr("stroke-width", 2)
        .attr("opacity", 0.95)
        .attr("d", lineUsers);

    // Data points (similar visibility treatment to performance trend chart)
    svg.selectAll("circle.timeline-point-pageviews")
        .data(data)
        .join("circle")
        .attr("class", "timeline-point-pageviews")
        .attr("cx", d => x(d.date))
        .attr("cy", d => y(d.pageviews))
        .attr("r", 3)
        .attr("fill", "#ced4da")
        .attr("opacity", 0.8);

    svg.selectAll("circle.timeline-point-sessions")
        .data(data)
        .join("circle")
        .attr("class", "timeline-point-sessions")
        .attr("cx", d => x(d.date))
        .attr("cy", d => y(d.sessions))
        .attr("r", 3.5)
        .attr("fill", "#7bb8f5")
        .attr("opacity", 0.85);

    svg.selectAll("circle.timeline-point-users")
        .data(data)
        .join("circle")
        .attr("class", "timeline-point-users")
        .attr("cx", d => x(d.date))
        .attr("cy", d => y(d.users))
        .attr("r", 3.5)
        .attr("fill", "#2880c8")
        .attr("opacity", 0.9);

    // 5. Axes
    svg.append("g").attr("transform", `translate(0,${innerHeight})`).attr("class", "chart-axis").call(d3.axisBottom(x).ticks(5).tickFormat(d3.timeFormat("%b %d")));
    svg.append("g").attr("class", "chart-axis").call(d3.axisLeft(y).ticks(5));

    // 6. Interactive Hover Line
    const hoverLine = svg.append("line").attr("class", "hover-line").attr("y1", 0).attr("y2", innerHeight);
    const bisectDate = d3.bisector(d => d.date).left;

    svg.append("rect")
        .attr("width", innerWidth).attr("height", innerHeight)
        .attr("fill", "none").attr("pointer-events", "all")
        .on("mouseover", () => { hoverLine.style("opacity", 1); tooltip.style("opacity", 1); })
        .on("mouseout", () => { hoverLine.style("opacity", 0); tooltip.style("opacity", 0); updateLegend(data[data.length - 1]); })
        .on("mousemove", (event) => {
            const x0 = x.invert(d3.pointer(event)[0]);
            const i = bisectDate(data, x0, 1);
            const d0 = data[i - 1];
            const d1 = data[i];
            let d = d0;
            if (d0 && d1) d = x0 - d0.date > d1.date - x0 ? d1 : d0;
            else d = d1 || d0;

            if(!d) return;

            const cx = x(d.date);
            hoverLine.attr("x1", cx).attr("x2", cx);

            const dateStr = d3.timeFormat("%Y/%m/%d")(d.date);
            tooltip.html(`
                <div class="tooltip-header">${dateStr}</div>
                Pageviews: ${d.pageviews}<br>
                Visits: ${d.sessions}<br>
                Unique Users: ${d.users}
            `);

            let tipX = cx + margin.left + 15;
            if (tipX + 120 > width) tipX = cx + margin.left - 130;
            tooltip.style("left", `${tipX}px`).style("top", `${margin.top + y(d.pageviews) / 2}px`);

            updateLegend(d);
        });
}

// ==========================================
// PAGEVIEW DISTRIBUTION ACROSS CORE PAGES
// ==========================================
function drawPageviewDistributionChart(events) {
    const chartContainer = d3.select("#pageview-distribution-chart");
    if (chartContainer.empty()) return;
    chartContainer.html("").style("position", "relative");
    const analyticsUtils = window.AnalyticsUtils || {};

    // Core pages to include in distribution (exclude 404)
    const CORE_PAGES = (analyticsUtils.CORE_PAGES || ['Home', 'Products', 'Product Detail', 'Checkout', 'Liquidation', '404'])
        .filter(page => page !== '404');
    
    // Color map for core pages
    const pageColors = {
        'Home': '#4472C4',
        'Products': '#ED7D31',
        'Product Detail': '#A5A5A5',
        'Checkout': '#FFC000',
        'Liquidation': '#5B9BD5'
    };

    const extractPagePath = typeof analyticsUtils.getEventPageLabel === 'function'
        ? analyticsUtils.getEventPageLabel
        : (() => null);

    if (!events || events.length === 0) {
        chartContainer.html('<p class="chart-empty-state">No data available.</p>');
        return;
    }
    
    // ==========================================
    // AGGREGATE PAGEVIEWS BY CORE PAGE
    // ==========================================
    
    const pageviewCounts = {
        'Home': 0,
        'Products': 0,
        'Product Detail': 0,
        'Checkout': 0,
        'Liquidation': 0
    };
    
    let totalCorePageviews = 0;

    events.filter(e => e.event_type === 'page_load').forEach(ev => {
        // Extract and normalize page
        const normalizedPage = extractPagePath(ev);
        if (!normalizedPage || normalizedPage === '404') return;  // Exclude 404
        
        // Count if it's a core page
        if (pageviewCounts.hasOwnProperty(normalizedPage)) {
            pageviewCounts[normalizedPage]++;
            totalCorePageviews++;
        }
    });

    if (totalCorePageviews === 0) {
        chartContainer.html('<p class="chart-empty-state">No core-page pageviews available.</p>');
        return;
    }

    console.log("[Pageview Distribution] ✓ Aggregated pageviews for last-30-days window");
    console.log("[Pageview Distribution] ✓ Core page distribution:", pageviewCounts);
    console.log("[Pageview Distribution] ✓ Total core pageviews:", totalCorePageviews);

    // ==========================================
    // PREPARE DATA FOR STACKED BAR
    // ==========================================
    
    const distributionData = CORE_PAGES.map(page => ({
        page,
        count: pageviewCounts[page],
        percentage: ((pageviewCounts[page] / totalCorePageviews) * 100).toFixed(1)
    }));

    // ==========================================
    // SETUP D3 CHART
    // ==========================================
    
    const width = Math.max(chartContainer.node().getBoundingClientRect().width || 600, 600);
    const height = 190;
    const margin = { top: 50, right: 20, bottom: 60, left: 20 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = chartContainer.append("svg")
        .attr("width", width)
        .attr("height", height)
        .style("max-width", "100%")
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    chartContainer.insert("div", ":first-child")
        .attr("class", "chart-title chart-title-small")
        .text("Pageview Distribution Across Core Pages");

    chartContainer.insert("p", "div + div")
        .attr("class", "chart-subtitle")
        .html("Share of pageviews across intended site pages (excludes 404 traffic · Last 30 Days)");

    // ==========================================
    // DRAW STACKED BAR
    // ==========================================
    
    let xOffset = 0;
    const segments = [];

    // Calculate segments for stacked bar
    distributionData.forEach(d => {
        segments.push({
            ...d,
            x0: xOffset,
            x1: xOffset + (d.count / totalCorePageviews) * innerW
        });
        xOffset = segments[segments.length - 1].x1;
    });

    // Tooltip
    const tooltip = chartContainer.append("div")
        .attr("class", "chart-tooltip")
        .style("opacity", 0)
        .style("position", "absolute")
        .style("pointer-events", "none")
        .style("z-index", "100");

    // Draw segments
    svg.selectAll("rect.segment")
        .data(segments)
        .join("rect")
        .attr("class", "segment")
        .attr("x", d => d.x0)
        .attr("y", 0)
        .attr("width", d => d.x1 - d.x0)
        .attr("height", innerH)
        .attr("fill", d => pageColors[d.page])
        .attr("opacity", 0.8)
        .style("cursor", "pointer")
        .on("mouseover", function(event, d) {
            d3.select(this).attr("opacity", 1);
        })
        .on("mouseout", function(event, d) {
            d3.select(this).attr("opacity", 0.8);
            tooltip.style("opacity", 0);
        })
        .on("mousemove", function(event, d) {
            let tooltipContent = `
                <div style="font-weight: bold; margin-bottom: 6px;">${d.page}</div>
                <div style="margin-bottom: 4px;">
                    <div>${d.count} pageviews</div>
                    <div style="font-weight: 600;">${d.percentage}% of core pageviews</div>
                </div>
                <div style="border-top: 1px solid #666; padding-top: 4px; margin-top: 6px; font-size: 11px; color: #aaa;">404 traffic excluded</div>
            `;
            
            tooltip.style("opacity", 1).html(tooltipContent);
            
            const [xPos, yPos] = d3.pointer(event, chartContainer.node());
            let tipX = xPos + 15;
            if (tipX + 200 > window.innerWidth) tipX = xPos - 210;
            tooltip.style("left", `${tipX}px`).style("top", `${yPos - 28}px`);
        });

    // Add segment labels inside bar (if space allows) or via legend
    const minSegmentWidth = 25;
    svg.selectAll("text.segment-label")
        .data(segments.filter(d => (d.x1 - d.x0) > minSegmentWidth))
        .join("text")
        .attr("class", "segment-label")
        .attr("x", d => d.x0 + (d.x1 - d.x0) / 2)
        .attr("y", innerH / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "middle")
        .attr("font-size", "11px")
        .attr("fill", "#fff")
        .attr("font-weight", "500")
        .text(d => d.percentage + "%");

    // Legend below bar
    const legendY = innerH + 30;
    const legendStartX = 56;
    const legendSpacing = (innerW - legendStartX) / CORE_PAGES.length;

    svg.append("text")
        .attr("x", 0)
        .attr("y", legendY + 4)
        .attr("font-size", "10px")
        .attr("fill", "#666")
        .attr("font-weight", "600")
        .text("Legend:");

    svg.selectAll("circle.legend-dot")
        .data(CORE_PAGES)
        .join("circle")
        .attr("class", "legend-dot")
        .attr("cx", (d, i) => legendStartX + i * legendSpacing + 5)
        .attr("cy", legendY)
        .attr("r", 3)
        .attr("fill", d => pageColors[d]);

    svg.selectAll("text.legend-text")
        .data(CORE_PAGES)
        .join("text")
        .attr("class", "legend-text")
        .attr("x", (d, i) => legendStartX + i * legendSpacing + 12)
        .attr("y", legendY + 4)
        .attr("font-size", "10px")
        .attr("fill", "#666")
        .text(d => d);

    console.log("[Pageview Distribution] ✓ Chart rendered successfully");
}

// ==========================================
// SESSION DEPTH DISTRIBUTION CHART
// ==========================================
function drawSessionDepthDistributionChart(events) {
    const chartContainer = d3.select("#session-depth-chart");
    if (chartContainer.empty()) return;
    chartContainer.html("").style("position", "relative");
    const analyticsUtils = window.AnalyticsUtils || {};
    const getEventPageLabel = typeof analyticsUtils.getEventPageLabel === 'function'
        ? analyticsUtils.getEventPageLabel
        : (() => null);

    // ==========================================
    // AGGREGATE PAGEVIEWS BY SESSION
    // ==========================================
    
    const sessionDepths = new Map();

    events.filter(e => e.event_type === 'page_load').forEach(ev => {
        const sessionId = ev.session_id;
        const pageLabel = getEventPageLabel(ev);
        if (!sessionId || !pageLabel) return;
        if (!sessionDepths.has(sessionId)) {
            sessionDepths.set(sessionId, 0);
        }
        sessionDepths.set(sessionId, sessionDepths.get(sessionId) + 1);
    });

    if (sessionDepths.size === 0) {
        chartContainer.html('<p class="chart-empty-state">No session data available.</p>');
        return;
    }

    // ==========================================
    // BUCKET SESSIONS BY DEPTH
    // ==========================================
    
    const depthBuckets = {
        '1 page': 0,
        '2 pages': 0,
        '3 pages': 0,
        '4 pages': 0,
        '5+ pages': 0
    };

    sessionDepths.forEach(depth => {
        if (depth === 1) depthBuckets['1 page']++;
        else if (depth === 2) depthBuckets['2 pages']++;
        else if (depth === 3) depthBuckets['3 pages']++;
        else if (depth === 4) depthBuckets['4 pages']++;
        else depthBuckets['5+ pages']++;
    });

    const totalSessions = sessionDepths.size;
    const chartData = Object.entries(depthBuckets).map(([bucket, count]) => ({
        bucket,
        count,
        percentage: ((count / totalSessions) * 100).toFixed(1)
    }));

    console.log("[Session Depth] ✓ Total sessions:", totalSessions);
    console.log("[Session Depth] ✓ Depth distribution:", depthBuckets);

    // ==========================================
    // SETUP D3 CHART
    // ==========================================
    
    const width = Math.max(chartContainer.node().getBoundingClientRect().width || 400, 400);
    const height = 300;
    const margin = { top: 50, right: 20, bottom: 40, left: 50 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = chartContainer.append("svg")
        .attr("width", width)
        .attr("height", height)
        .style("max-width", "100%")
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    chartContainer.insert("div", ":first-child")
        .attr("class", "chart-title chart-title-small")
        .text("Session Depth Distribution");

    chartContainer.insert("p", "div + div")
        .attr("class", "chart-subtitle")
        .html("Distribution of pages viewed per visit (Last 30 Days)");

    // ==========================================
    // SCALES & AXES
    // ==========================================
    
    const maxCount = d3.max(chartData, d => d.count) || 1;
    const x = d3.scaleBand()
        .domain(chartData.map(d => d.bucket))
        .range([0, innerW])
        .padding(0.3);

    const y = d3.scaleLinear()
        .domain([0, maxCount * 1.15])
        .range([innerH, 0]);

    // Tooltip
    const tooltip = chartContainer.append("div")
        .attr("class", "chart-tooltip")
        .style("opacity", 0)
        .style("position", "absolute")
        .style("pointer-events", "none")
        .style("z-index", "100");

    // ==========================================
    // DRAW BARS
    // ==========================================
    
    const barColors = ['#4472C4', '#ED7D31', '#A5A5A5', '#5B9BD5', '#70AD47'];

    svg.selectAll("rect.depth-bar")
        .data(chartData)
        .join("rect")
        .attr("class", "depth-bar")
        .attr("x", d => x(d.bucket))
        .attr("y", d => y(d.count))
        .attr("width", x.bandwidth())
        .attr("height", d => innerH - y(d.count))
        .attr("fill", (d, i) => barColors[i % barColors.length])
        .attr("opacity", 0.85)
        .style("cursor", "pointer")
        .on("mouseover", function() {
            d3.select(this).attr("opacity", 1);
        })
        .on("mouseout", function() {
            d3.select(this).attr("opacity", 0.85);
            tooltip.style("opacity", 0);
        })
        .on("mousemove", function(event, d) {
            let tooltipContent = `
                <div style="font-weight: bold; margin-bottom: 6px;">${d.bucket}</div>
                <div style="margin-bottom: 4px;">
                    <div style="font-weight: 600;">${d.count} sessions</div>
                    <div style="font-size: 11px; color: #ccc; margin-top: 2px;">${d.percentage}% of visits</div>
                </div>
            `;
            
            tooltip.style("opacity", 1).html(tooltipContent);
            
            const [xPos, yPos] = d3.pointer(event, chartContainer.node());
            let tipX = xPos + 15;
            if (tipX + 200 > window.innerWidth) tipX = xPos - 210;
            tooltip.style("left", `${tipX}px`).style("top", `${yPos - 28}px`);
        });

    // Value labels on bars
    svg.selectAll("text.depth-label")
        .data(chartData)
        .join("text")
        .attr("class", "depth-label")
        .attr("x", d => x(d.bucket) + x.bandwidth() / 2)
        .attr("y", d => y(d.count) - 8)
        .attr("text-anchor", "middle")
        .attr("font-size", "13px")
        .attr("fill", "#333")
        .attr("font-weight", "600")
        .text(d => d.count);

    // Axes
    svg.append("g")
        .attr("transform", `translate(0,${innerH})`)
        .attr("class", "chart-axis")
        .call(d3.axisBottom(x));

    svg.append("g")
        .attr("class", "chart-axis")
        .call(d3.axisLeft(y).ticks(5));

    console.log("[Session Depth] ✓ Chart rendered successfully");
}

// ==========================================
// AVG INTERACTIONS BY PAGE CHART
// ==========================================
function drawAvgInteractionsByPageChart(events) {
    const chartContainer = d3.select("#avg-interactions-chart");
    if (chartContainer.empty()) return;
    chartContainer.html("").style("position", "relative");
    const analyticsUtils = window.AnalyticsUtils || {};
    const extractPagePath = typeof analyticsUtils.getEventPageLabel === 'function'
        ? analyticsUtils.getEventPageLabel
        : (() => null);
    const pageBuckets = analyticsUtils.CORE_PAGES || ['Home', 'Products', 'Product Detail', 'Checkout', 'Liquidation', '404'];

    // ==========================================
    // AGGREGATE INTERACTIONS BY PAGE
    // ==========================================
    
    const pageStats = {};
    pageBuckets.forEach(page => {
        pageStats[page] = { visits: 0, clicks: 0, scrolls: 0, keyInputs: 0 };
    });

    const pagesBySession = new Map();

    // First pass: count visits per page per session
    events.filter(e => e.event_type === 'page_load').forEach(ev => {
        const sessionId = ev.session_id;
        const normalizedPage = extractPagePath(ev);
        
        if (!normalizedPage || !pageStats.hasOwnProperty(normalizedPage)) return;
        
        // Track which pages were visited in each session (for deduplication per session)
        if (!pagesBySession.has(sessionId)) {
            pagesBySession.set(sessionId, new Set());
        }
        pagesBySession.get(sessionId).add(normalizedPage);
    });

    // Count unique visits per page (deduped by session)
    pagesBySession.forEach((pagesInSession) => {
        pagesInSession.forEach(page => {
            pageStats[page].visits++;
        });
    });

    // Second pass: count interactions by type
    events.forEach(ev => {
        if (!ev.session_id || !ev.raw_data) return;
        
        const normalizedPage = extractPagePath(ev);
        if (!normalizedPage || !pageStats.hasOwnProperty(normalizedPage)) return;

        // Process activity_update events with activities array
        if (ev.event_type === 'activity_update' && ev.raw_data?.activities && Array.isArray(ev.raw_data.activities)) {
            ev.raw_data.activities.forEach(activity => {
                if (activity.type === 'click' || activity.type === 'mousedown') {
                    pageStats[normalizedPage].clicks++;
                } else if (activity.type === 'scroll') {
                    pageStats[normalizedPage].scrolls++;
                } else if (activity.type === 'keydown') {
                    pageStats[normalizedPage].keyInputs++;
                }
            });
        }
        
        // Process page_exit events with activities array
        if (ev.event_type === 'page_exit' && ev.raw_data?.activities && Array.isArray(ev.raw_data.activities)) {
            ev.raw_data.activities.forEach(activity => {
                if (activity.type === 'click' || activity.type === 'mousedown') {
                    pageStats[normalizedPage].clicks++;
                } else if (activity.type === 'scroll') {
                    pageStats[normalizedPage].scrolls++;
                } else if (activity.type === 'keydown') {
                    pageStats[normalizedPage].keyInputs++;
                }
            });
        }
    });

    // ==========================================
    // CALCULATE AVERAGES
    // ==========================================
    
    const chartData = Object.entries(pageStats)
        .filter(([page, stats]) => stats.visits > 0)
        .map(([page, stats]) => ({
            page,
            visits: stats.visits,
            avgClicks: (stats.clicks / stats.visits).toFixed(2),
            avgScrolls: (stats.scrolls / stats.visits).toFixed(2),
            avgKeyInputs: (stats.keyInputs / stats.visits).toFixed(2),
            totalAvgInteractions: ((stats.clicks + stats.scrolls + stats.keyInputs) / stats.visits).toFixed(2)
        }))
        .sort((a, b) => parseFloat(b.totalAvgInteractions) - parseFloat(a.totalAvgInteractions));

    if (chartData.length === 0) {
        chartContainer.html('<p class="chart-empty-state">No interaction data available.</p>');
        return;
    }

    console.log("[Avg Interactions] ✓ Page interaction stats:", pageStats);
    console.log("[Avg Interactions] ✓ Calculated averages:", chartData);
    
    // Debug: log raw events that contribute to interactions
    let activityEventCount = 0;
    events.forEach(ev => {
        if ((ev.event_type === 'activity_update' || ev.event_type === 'page_exit') && 
            ev.raw_data?.activities && Array.isArray(ev.raw_data.activities) && 
            ev.raw_data.activities.length > 0) {
            activityEventCount++;
        }
    });
    console.log("[Avg Interactions] ✓ Activity events found:", activityEventCount);

    // ==========================================
    // SETUP D3 CHART
    // ==========================================
    
    const width = Math.max(chartContainer.node().getBoundingClientRect().width || 450, 450);
    const height = 50 + chartData.length * 50;
    const margin = { top: 50, right: 30, bottom: 50, left: 120 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = chartContainer.append("svg")
        .attr("width", width)
        .attr("height", height)
        .style("max-width", "100%")
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    chartContainer.insert("div", ":first-child")
        .attr("class", "chart-title chart-title-small")
        .text("Avg Interactions by Page");

    chartContainer.insert("p", "div + div")
        .attr("class", "chart-subtitle")
        .html("Clicks, scrolls, and key inputs per visit (Last 30 Days)");

    // ==========================================
    // SCALES
    // ==========================================
    
    const maxInteractions = d3.max(chartData, d => parseFloat(d.totalAvgInteractions)) || 1;

    const x = d3.scaleLinear()
        .domain([0, maxInteractions * 1.1])
        .range([0, innerW]);

    const y = d3.scaleBand()
        .domain(chartData.map(d => d.page))
        .range([0, innerH])
        .padding(0.3);

    // Colors for interaction types
    const interactionColors = {
        clicks: '#4472C4',
        scrolls: '#ED7D31',
        keyInputs: '#A5A5A5'
    };

    // Tooltip
    const tooltip = chartContainer.append("div")
        .attr("class", "chart-tooltip")
        .style("opacity", 0)
        .style("position", "absolute")
        .style("pointer-events", "none")
        .style("z-index", "100");

    // ==========================================
    // DRAW STACKED BARS
    // ==========================================
    
    // Draw clicks segment
    svg.selectAll("rect.interaction-clicks")
        .data(chartData)
        .join("rect")
        .attr("class", "interaction-clicks")
        .attr("x", 0)
        .attr("y", d => y(d.page))
        .attr("width", d => x(parseFloat(d.avgClicks)))
        .attr("height", y.bandwidth())
        .attr("fill", interactionColors.clicks)
        .attr("opacity", 0.85);

    // Draw scrolls segment
    svg.selectAll("rect.interaction-scrolls")
        .data(chartData)
        .join("rect")
        .attr("class", "interaction-scrolls")
        .attr("x", d => x(parseFloat(d.avgClicks)))
        .attr("y", d => y(d.page))
        .attr("width", d => x(parseFloat(d.avgScrolls)))
        .attr("height", y.bandwidth())
        .attr("fill", interactionColors.scrolls)
        .attr("opacity", 0.85);

    // Draw keyInputs segment
    svg.selectAll("rect.interaction-keyinputs")
        .data(chartData)
        .join("rect")
        .attr("class", "interaction-keyinputs")
        .attr("x", d => x(parseFloat(d.avgClicks) + parseFloat(d.avgScrolls)))
        .attr("y", d => y(d.page))
        .attr("width", d => x(parseFloat(d.avgKeyInputs)))
        .attr("height", y.bandwidth())
        .attr("fill", interactionColors.keyInputs)
        .attr("opacity", 0.85);

    // Draw total value labels
    svg.selectAll("text.interaction-label")
        .data(chartData)
        .join("text")
        .attr("class", "interaction-label")
        .attr("x", d => x(parseFloat(d.totalAvgInteractions)) + 5)
        .attr("y", d => y(d.page) + y.bandwidth() / 2)
        .attr("dy", "0.35em")
        .attr("font-size", "12px")
        .attr("fill", "#333")
        .attr("font-weight", "600")
        .text(d => d.totalAvgInteractions);

    // Interactive hover regions
    svg.selectAll("rect.interaction-hover")
        .data(chartData)
        .join("rect")
        .attr("class", "interaction-hover")
        .attr("x", 0)
        .attr("y", d => y(d.page))
        .attr("width", d => x(parseFloat(d.totalAvgInteractions)))
        .attr("height", y.bandwidth())
        .attr("fill", "transparent")
        .style("cursor", "pointer")
        .on("mouseover", function() {
            d3.select(this).style("opacity", 0.1);
        })
        .on("mouseout", function() {
            d3.select(this).style("opacity", 0);
            tooltip.style("opacity", 0);
        })
        .on("mousemove", function(event, d) {
            let tooltipContent = `
                <div style="font-weight: bold; margin-bottom: 6px;">${d.page}</div>
                <div style="margin-bottom: 4px;">
                    <div style="font-weight: 600;">Avg interactions/visit: ${d.totalAvgInteractions}</div>
                    <div style="font-size: 11px; color: #ccc; margin-top: 2px;">
                        Clicks: ${d.avgClicks} · Scrolls: ${d.avgScrolls} · Key inputs: ${d.avgKeyInputs}
                    </div>
                    <div style="border-top: 1px solid #666; padding-top: 4px; margin-top: 6px; font-size: 11px; color: #aaa;">
                        Based on ${d.visits} visits
                    </div>
                </div>
            `;
            
            tooltip.style("opacity", 1).html(tooltipContent);
            
            const [xPos, yPos] = d3.pointer(event, chartContainer.node());
            let tipX = xPos + 15;
            if (tipX + 250 > window.innerWidth) tipX = xPos - 260;
            tooltip.style("left", `${tipX}px`).style("top", `${yPos - 28}px`);
        });

    // Axes
    svg.append("g")
        .attr("transform", `translate(0,${innerH})`)
        .attr("class", "chart-axis")
        .call(d3.axisBottom(x).ticks(4));

    svg.append("g")
        .attr("class", "chart-axis")
        .call(d3.axisLeft(y).tickSizeOuter(0));

    // Legend
    const legendY = innerH + 25;
    const legendData = [
        { label: 'Clicks', color: interactionColors.clicks },
        { label: 'Scrolls', color: interactionColors.scrolls },
        { label: 'Key Inputs', color: interactionColors.keyInputs }
    ];

    let legendX = 0;
    legendData.forEach(item => {
        svg.append("rect")
            .attr("x", legendX)
            .attr("y", legendY)
            .attr("width", 12)
            .attr("height", 12)
            .attr("fill", item.color)
            .attr("opacity", 0.85);

        svg.append("text")
            .attr("x", legendX + 18)
            .attr("y", legendY + 10)
            .text(item.label)
            .attr("font-size", "11px")
            .attr("fill", "#666");

        legendX += 100;
    });

    console.log("[Avg Interactions] ✓ Chart rendered successfully");
}
