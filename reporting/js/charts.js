document.addEventListener('analyticsDataLoaded', (e) => {
    const rawEvents = e.detail;

    const events = rawEvents.map(ev => {
        let parsedData = {};
        if (ev.raw_data) {
            try { parsedData = typeof ev.raw_data === 'string' ? JSON.parse(ev.raw_data) : ev.raw_data; } 
            catch (err) { console.error("JSON Parse error on ID", ev.id); }
        }
        return { ...ev, raw_data: parsedData };
    });

    drawPerformanceChart(events);
    drawActivityChart(events);
});

function drawPerformanceChart(events) {
    // 1. Filter and format data
    const loadEvents = events
        .filter(d => d.event_type === 'page_load' && d.raw_data?.performance?.totalLoadTime)
        .map(d => ({
            id: d.id,
            time: d.raw_data.performance.totalLoadTime
        })).reverse(); // Reverse so oldest is on the left

    const chartContainer = d3.select("#performance-chart");
    chartContainer.html("");

    if (loadEvents.length === 0) {
        document.getElementById('performance-chart').innerHTML = '<p>No performance data available.</p>';
        return;
    }

    // 2. Setup SVG dimensions
    const width = 460, height = 300, margin = {top: 20, right: 20, bottom: 60, left: 65};
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = chartContainer.append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // 3. Scales
    const x = d3.scaleBand().domain(loadEvents.map(d => d.id)).range([0, innerWidth]).padding(0.1);
    const y = d3.scaleLinear().domain([0, d3.max(loadEvents, d => d.time) * 1.2]).range([innerHeight, 0]);

    // 4. Draw Bars
    svg.selectAll(".bar")
        .data(loadEvents)
        .enter().append("rect")
        .attr("class", "bar")
        .attr("x", d => x(d.id))
        .attr("y", d => y(d.time))
        .attr("width", x.bandwidth())
        .attr("height", d => innerHeight - y(d.time))
        .attr("fill", d => d.time > 1000 ? "#dc3545" : "#28a745") // Red if slow, Green if fast
        .append("title")
        .text(d => `Load Time: ${Math.round(d.time)} ms`);

    // 5. Axes & Threshold Line
    svg.append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x).tickValues([])); // Keep ticks hidden, use axis label for clarity

    svg.append("g")
        .call(d3.axisLeft(y).ticks(5).tickFormat(d => `${d} ms`));

    // Axis Labels
    svg.append("text")
        .attr("x", innerWidth / 2)
        .attr("y", innerHeight + 45)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .style("fill", "#333")
        .text("Page Load Events (chronological)");

    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("x", -innerHeight / 2)
        .attr("y", -45)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .style("fill", "#333")
        .text("Load Time (ms)");
    
    // 1000ms SLA Line
    svg.append("line")
        .attr("class", "threshold-line")
        .attr("x1", 0).attr("x2", innerWidth)
        .attr("y1", y(1000)).attr("y2", y(1000));
}

function drawActivityChart(events) {
    // 1. Aggregate activity counts
    const counts = { click: 0, mousemove: 0, keydown: 0, scroll: 0 };
    events.filter(d => d.event_type === 'activity_update' && d.raw_data?.activities).forEach(ev => {
        ev.raw_data.activities.forEach(act => {
            if (counts[act.type] !== undefined) counts[act.type]++;
        });
    });

    const data = Object.entries(counts).filter(([key, val]) => val > 0).map(([key, value]) => ({key, value}));

    if (data.length === 0) {
        document.getElementById('activity-chart').innerHTML = '<p>No activity data available.</p>';
        return;
    }

    // 2. Setup SVG
    const width = 300, height = 250, radius = Math.min(width, height) / 2;
    const svg = d3.select("#activity-chart").append("svg")
        .attr("width", width).attr("height", height)
        .append("g").attr("transform", `translate(${width/2},${height/2})`);

    // 3. Colors & Generators
    const color = d3.scaleOrdinal().domain(data.map(d => d.key)).range(["#007bff", "#17a2b8", "#ffc107", "#28a745"]);
    const pie = d3.pie().value(d => d.value);
    const arc = d3.arc().innerRadius(radius * 0.5).outerRadius(radius * 0.8);

    // 4. Draw Slices
    svg.selectAll('path')
        .data(pie(data))
        .enter().append('path')
        .attr('d', arc)
        .attr('fill', d => color(d.data.key))
        .attr("stroke", "white")
        .style("stroke-width", "2px");

    // 5. Labels
    svg.selectAll('text')
        .data(pie(data))
        .enter().append('text')
        .text(d => d.data.key)
        .attr("transform", d => `translate(${arc.centroid(d)})`)
        .style("text-anchor", "middle")
        .style("font-size", "10px")
        .style("fill", "#333");
}