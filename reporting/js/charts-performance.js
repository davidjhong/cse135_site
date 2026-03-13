function drawLoadTimeChart(events) {
    const chartContainer = d3.select("#loadtime-chart");
    if (chartContainer.empty()) return;
    chartContainer.html("");

    // 1. Data Parsing & Aggregation
    const dailyPathStats = new Map();

    events.filter(d => d.event_type === 'page_load' && d.raw_data?.performance?.totalLoadTime).forEach(ev => {
        if (!ev.created_at) return;
        
        const dateKey = ev.created_at.split(' ')[0];
        let pathName = 'unknown';
        try {
            const urlObj = new URL(ev.raw_data.url);
            pathName = urlObj.pathname;
            if (pathName === '') pathName = '/';
        } catch (e) {
            console.warn("Invalid URL in payload:", ev.raw_data.url);
        }

        const loadTime = ev.raw_data.performance.totalLoadTime;
        const compositeKey = `${dateKey}|${pathName}`;

        if (!dailyPathStats.has(compositeKey)) {
            dailyPathStats.set(compositeKey, { date: new Date(dateKey + 'T00:00:00'), path: pathName, sum: 0, count: 0 });
        }
        
        const stat = dailyPathStats.get(compositeKey);
        stat.sum += loadTime;
        stat.count++;
    });

    const flatData = Array.from(dailyPathStats.values()).map(d => ({
        date: d.date,
        path: d.path,
        avgLoadTime: Math.round(d.sum / d.count)
    })).sort((a, b) => a.date - b.date);

    if (flatData.length === 0) {
        chartContainer.html('<p class="chart-empty-state">No performance data available.</p>');
        return;
    }

    // Group data by URL path for the multi-line drawing
    const nestedData = d3.group(flatData, d => d.path);
    const uniquePaths = Array.from(nestedData.keys());

    // 2. Setup Dimensions
    const width = 560, height = 350;
    const margin = {top: 70, right: 120, bottom: 30, left: 50}; // Extra right margin for line labels
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = chartContainer.append("svg")
        .attr("width", width).attr("height", height)
        .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // Top Title
    chartContainer.insert("div", ":first-child")
        .attr("class", "chart-title")
        .text("Average Page Load Time (ms)");

    // Tooltip
    const tooltip = chartContainer.append("div")
        .attr("class", "chart-tooltip");

    // 3. Scales & Colors
    const x = d3.scaleTime().domain(d3.extent(flatData, d => d.date)).range([0, innerWidth]);
    const yMax = Math.max(d3.max(flatData, d => d.avgLoadTime) || 1000, 1000); // Base ceiling of 1s
    const y = d3.scaleLinear().domain([0, yMax * 1.1]).range([innerHeight, 0]);
    const color = d3.scaleOrdinal(d3.schemeCategory10).domain(uniquePaths);

    // 4. Line Generator
    const lineGenerator = d3.line()
        .x(d => x(d.date))
        .y(d => y(d.avgLoadTime))
        .curve(d3.curveMonotoneX);

    // 5. Draw Lines and Labels
    nestedData.forEach((values, path) => {
        svg.append("path")
            .datum(values)
            .attr("fill", "none")
            .attr("stroke", color(path))
            .attr("stroke-width", 2)
            .attr("d", lineGenerator);

        // Add path label at the end of the line
        const lastPoint = values[values.length - 1];
        svg.append("text")
            .attr("transform", `translate(${x(lastPoint.date) + 5},${y(lastPoint.avgLoadTime) + 4})`)
            .attr("font-size", "11px")
            .attr("fill", color(path))
            .text(path);
    });

    // 6. Axes
    svg.append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .attr("class", "chart-axis")
        .call(d3.axisBottom(x).ticks(5).tickFormat(d3.timeFormat("%b %d")));

    svg.append("g")
        .attr("class", "chart-axis")
        .call(d3.axisLeft(y).ticks(6));

    // 7. Interactive Exploratory Hover Line
    const hoverLine = svg.append("line")
        .attr("class", "hover-line")
        .attr("y1", 0).attr("y2", innerHeight);

    const bisectDate = d3.bisector(d => d.date).left;

    // Group flat data by date for the tooltip
    const dataByDate = d3.group(flatData, d => d.date.getTime());
    const uniqueDates = Array.from(dataByDate.keys()).map(t => new Date(t)).sort((a, b) => a - b);

    svg.append("rect")
        .attr("width", innerWidth).attr("height", innerHeight)
        .attr("fill", "none").attr("pointer-events", "all")
        .on("mouseover", () => { hoverLine.style("opacity", 1); tooltip.style("opacity", 1); })
        .on("mouseout", () => { hoverLine.style("opacity", 0); tooltip.style("opacity", 0); })
        .on("mousemove", (event) => {
            const x0 = x.invert(d3.pointer(event)[0]);
            
            // Find the closest date in our dataset
            const i = bisectDate(uniqueDates, x0, 1);
            const d0 = uniqueDates[i - 1];
            const d1 = uniqueDates[i];
            let closestDate = d0;
            if (d0 && d1) closestDate = x0 - d0 > d1 - x0 ? d1 : d0;
            else closestDate = d1 || d0;

            if (!closestDate) return;

            const cx = x(closestDate);
            hoverLine.attr("x1", cx).attr("x2", cx);

            // Build tooltip HTML dynamically based on paths loaded that day
            const dateStr = d3.timeFormat("%Y/%m/%d")(closestDate);
            const dayStats = dataByDate.get(closestDate.getTime());
            
            let tooltipHtml = `<div class="tooltip-header">${dateStr}</div>`;
            dayStats.forEach(stat => {
                tooltipHtml += `<span style="color:${color(stat.path)}">&#9679;</span> ${stat.path}: ${stat.avgLoadTime}ms<br>`;
            });

            tooltip.html(tooltipHtml);

            let tipX = cx + margin.left + 15;
            if (tipX + 150 > width) tipX = cx + margin.left - 160;
            tooltip.style("left", `${tipX}px`).style("top", `${margin.top + 20}px`);
        });
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