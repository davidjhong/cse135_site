window.drawLoadTimeChart = function(events) {
    const chartContainer = d3.select("#loadtime-chart");
    if (chartContainer.empty()) return;
    chartContainer.html("");
    chartContainer.style("position", "relative");

    // 1. Data Parsing & Path Cleanup
    const rawDailyStats = new Map();
    const datesSet = new Set();
    const pathsSet = new Set();

    events.filter(d => d.event_type === 'page_load' && d.raw_data?.performance?.totalLoadTime).forEach(ev => {
        if (!ev.created_at) return;
        
        const dateStr = ev.created_at.split(' ')[0];
        const dateTime = new Date(dateStr + 'T00:00:00').getTime();

        let pathName = 'unknown';
        try {
            const urlObj = new URL(ev.raw_data.url);
            pathName = urlObj.pathname;
            
            // Clean up paths for the legend
            if (pathName === '/' || pathName === '/index.html' || pathName === '/index.php') {
                pathName = 'Home';
            } else {
                pathName = pathName.replace(/^\//, ''); // Remove leading slash
            }
        } catch (e) {
            console.warn("Invalid URL in payload:", ev.raw_data.url);
        }

        const loadTime = ev.raw_data.performance.totalLoadTime;
        const key = `${dateTime}|${pathName}`;

        datesSet.add(dateTime);
        pathsSet.add(pathName);

        if (!rawDailyStats.has(key)) {
            rawDailyStats.set(key, { sum: 0, count: 0 });
        }
        
        const stat = rawDailyStats.get(key);
        stat.sum += loadTime;
        stat.count++;
    });

    const uniqueDates = Array.from(datesSet).sort((a, b) => a - b);
    const uniquePaths = Array.from(pathsSet);

    if (uniqueDates.length === 0) {
        chartContainer.html('<p class="chart-empty-state">No performance data available.</p>');
        return;
    }

    // 2. Data Imputation (Forward-Fill to prevent chopped lines)
    const flatData = [];
    const dataByDate = new Map();
    uniqueDates.forEach(t => dataByDate.set(t, []));

    uniquePaths.forEach(path => {
        let lastKnownAvg = null;

        // Find the first available value to backfill if the chart starts with missing data
        for (let t of uniqueDates) {
            const key = `${t}|${path}`;
            if (rawDailyStats.has(key)) {
                lastKnownAvg = Math.round(rawDailyStats.get(key).sum / rawDailyStats.get(key).count);
                break;
            }
        }
        if (lastKnownAvg === null) lastKnownAvg = 0;

        // Generate data points for every single day to keep lines continuous
        uniqueDates.forEach(t => {
            const key = `${t}|${path}`;
            let avg;
            if (rawDailyStats.has(key)) {
                avg = Math.round(rawDailyStats.get(key).sum / rawDailyStats.get(key).count);
                lastKnownAvg = avg; // Update the carry-forward value
            } else {
                avg = lastKnownAvg; // Carry forward the previous day's average
            }

            const dataPoint = { date: new Date(t), path: path, avgLoadTime: avg };
            flatData.push(dataPoint);
            dataByDate.get(t).push(dataPoint);
        });
    });

    // 3. Setup Dimensions (Increased top margin for Legend, decreased right margin)
    const width = 560, height = 350;
    const margin = {top: 90, right: 30, bottom: 30, left: 50}; 
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = chartContainer.append("svg")
        .attr("width", width).attr("height", height)
        .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // Top Title
    chartContainer.insert("div", ":first-child")
        .attr("class", "chart-title")
        .text("Average Page Load Time (ms)");

    const tooltip = chartContainer.append("div").attr("class", "chart-tooltip");

    // Scales & Colors
    const x = d3.scaleTime().domain(d3.extent(uniqueDates, d => new Date(d))).range([0, innerWidth]);
    const yMax = Math.max(d3.max(flatData, d => d.avgLoadTime) || 1000, 1000); 
    const y = d3.scaleLinear().domain([0, yMax * 1.1]).range([innerHeight, 0]);
    const color = d3.scaleOrdinal(d3.schemeCategory10).domain(uniquePaths);

    // 4. Dynamic Legend Palette (Wraps if too many items)
    const legend = svg.append("g").attr("transform", `translate(0, -50)`);
    let legendX = 0;
    let legendY = 0;

    uniquePaths.forEach(path => {
        const textWidth = path.length * 7 + 25; // Approximate pixel width of text
        if (legendX + textWidth > innerWidth) {
            legendX = 0;
            legendY += 15; // Drop to next line
        }
        
        const legendItem = legend.append("g").attr("transform", `translate(${legendX}, ${legendY})`);
        legendItem.append("rect").attr("width", 10).attr("height", 10).attr("fill", color(path));
        legendItem.append("text").attr("x", 15).attr("y", 9).attr("font-size", "11px").text(path);
        
        legendX += textWidth + 10;
    });

    // 5. Line Generator & Drawing
    const nestedData = d3.group(flatData, d => d.path);
    const lineGenerator = d3.line()
        .x(d => x(d.date))
        .y(d => y(d.avgLoadTime))
        .curve(d3.curveMonotoneX);

    nestedData.forEach((values, path) => {
        svg.append("path")
            .datum(values)
            .attr("fill", "none")
            .attr("stroke", color(path))
            .attr("stroke-width", 2)
            .attr("d", lineGenerator);
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

    const bisectDate = d3.bisector(d => d).left;

    svg.append("rect")
        .attr("width", innerWidth).attr("height", innerHeight)
        .attr("fill", "none").attr("pointer-events", "all")
        .on("mouseover", () => { hoverLine.style("opacity", 1); tooltip.style("opacity", 1); })
        .on("mouseout", () => { hoverLine.style("opacity", 0); tooltip.style("opacity", 0); })
        .on("mousemove", (event) => {
            const x0 = x.invert(d3.pointer(event)[0]).getTime();
            
            const i = bisectDate(uniqueDates, x0, 1);
            const d0 = uniqueDates[i - 1];
            const d1 = uniqueDates[i];
            const closestTime = (d0 && d1) ? (x0 - d0 > d1 - x0 ? d1 : d0) : (d1 || d0);

            if (!closestTime) return;

            const cx = x(new Date(closestTime));
            hoverLine.attr("x1", cx).attr("x2", cx);

            const dateStr = d3.timeFormat("%Y/%m/%d")(new Date(closestTime));
            const dayStats = dataByDate.get(closestTime);
            
            // Tooltip now shows data for ALL paths thanks to imputation
            let tooltipHtml = `<div class="tooltip-header">${dateStr}</div>`;
            dayStats.forEach(stat => {
                tooltipHtml += `<span style="color:${color(stat.path)}">&#9679;</span> ${stat.path}: ${stat.avgLoadTime}ms<br>`;
            });

            tooltip.html(tooltipHtml);

            let tipX = cx + margin.left + 15;
            if (tipX + 150 > width) tipX = cx + margin.left - 160;
            tooltip.style("left", `${tipX}px`).style("top", `${margin.top + 20}px`);
        });
};

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