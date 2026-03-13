window.drawLoadTimeChart = function(events) {
    const chartContainer = d3.select("#loadtime-chart");
    if (chartContainer.empty()) return;
    chartContainer.html("");
    chartContainer.style("position", "relative");

    // 1. Data Parsing & Path Cleanup
    const flatData = [];
    const pathsSet = new Set();

    events.filter(d => d.event_type === 'page_load' && d.raw_data?.performance?.totalLoadTime).forEach(ev => {
        if (!ev.created_at) return;
        
        // Parse exact timestamp for true scatter plot accuracy
        const dateTime = new Date(ev.created_at);

        let pathName = 'Unknown';
        try {
            const urlObj = new URL(ev.raw_data.url);
            let rawPath = urlObj.pathname;
            
            // Apply requested presentation names
            if (rawPath === '/' || rawPath === '/index.html' || rawPath === '/index.php') {
                pathName = 'Home';
            } else if (rawPath.includes('checkout')) {
                pathName = 'Checkout';
            } else if (rawPath.includes('product-detail')) {
                pathName = 'Product Detail';
            } else if (rawPath.includes('products')) {
                pathName = 'Product';
            } else {
                pathName = rawPath.replace(/^\//, ''); // Fallback
            }
        } catch (e) {
            console.warn("Invalid URL in payload:", ev.raw_data.url);
        }

        const loadTime = ev.raw_data.performance.totalLoadTime;
        pathsSet.add(pathName);

        flatData.push({
            date: dateTime,
            path: pathName,
            loadTime: loadTime
        });
    });

    if (flatData.length === 0) {
        chartContainer.html('<p class="chart-empty-state">No performance data available.</p>');
        return;
    }

    const uniquePaths = Array.from(pathsSet);

    // 2. Setup Dimensions
    const width = 560, height = 350;
    const margin = {top: 90, right: 30, bottom: 40, left: 60}; 
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = chartContainer.append("svg")
        .attr("width", width).attr("height", height)
        .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // Title
    chartContainer.insert("div", ":first-child")
        .attr("class", "chart-title")
        .text("Page Load Time Scatter Plot (ms)");

    const tooltip = chartContainer.append("div")
        .attr("class", "chart-tooltip")
        .style("opacity", 0)
        .style("position", "absolute")
        .style("pointer-events", "none");

    // 3. Scales & Colors
    // Ensure the domain covers the exact min and max timestamps
    const xDomain = d3.extent(flatData, d => d.date);
    // Add a tiny buffer to X so dots don't clip the Y-axis
    const timeBuffer = (xDomain[1] - xDomain[0]) * 0.05 || 3600000; 
    const x = d3.scaleTime().domain([new Date(xDomain[0].getTime() - timeBuffer), new Date(xDomain[1].getTime() + timeBuffer)]).range([0, innerWidth]);
    
    const yMax = Math.max(d3.max(flatData, d => d.loadTime) || 1000, 1000); 
    const y = d3.scaleLinear().domain([0, yMax * 1.1]).range([innerHeight, 0]);
    const color = d3.scaleOrdinal(d3.schemeCategory10).domain(uniquePaths);

    // 4. Dynamic Legend Palette
    const legend = svg.append("g").attr("transform", `translate(0, -50)`);
    let legendX = 0, legendY = 0;

    uniquePaths.forEach(path => {
        const textWidth = path.length * 7 + 25; 
        if (legendX + textWidth > innerWidth) {
            legendX = 0;
            legendY += 15; 
        }
        
        const legendItem = legend.append("g").attr("transform", `translate(${legendX}, ${legendY})`);
        legendItem.append("circle").attr("r", 5).attr("cx", 5).attr("cy", 5).attr("fill", color(path));
        legendItem.append("text").attr("x", 15).attr("y", 9).attr("font-size", "11px").text(path);
        
        legendX += textWidth + 10;
    });

    // 5. Draw Scatter Points
    svg.selectAll("dot")
        .data(flatData)
        .join("circle")
        .attr("cx", d => x(d.date))
        .attr("cy", d => y(d.loadTime))
        .attr("r", 5)
        .attr("fill", d => color(d.path))
        .attr("opacity", 0.7) // Semi-transparent to show clustering
        .attr("stroke", "#fff")
        .attr("stroke-width", 0.5)
        .on("mouseover", function(event, d) {
            d3.select(this).attr("r", 8).attr("opacity", 1).attr("stroke", "#333");
            
            const dateStr = d3.timeFormat("%b %d, %Y %I:%M:%S %p")(d.date);
            tooltip.style("opacity", 1)
                   .html(`<strong>${d.path}</strong><br>Time: ${dateStr}<br>Load: ${d.loadTime}ms`);
        })
        .on("mousemove", (event) => {
            // Position tooltip relative to the mouse
            let tipX = event.pageX + 15;
            let tipY = event.pageY - 28;
            tooltip.style("left", `${tipX}px`).style("top", `${tipY}px`);
        })
        .on("mouseout", function() {
            d3.select(this).attr("r", 5).attr("opacity", 0.7).attr("stroke", "#fff");
            tooltip.style("opacity", 0);
        });

    // 6. Axes
    svg.append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .attr("class", "chart-axis")
        .call(d3.axisBottom(x).ticks(5).tickFormat(d3.timeFormat("%b %d %H:%M")));

    svg.append("g")
        .attr("class", "chart-axis")
        .call(d3.axisLeft(y).ticks(6));
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