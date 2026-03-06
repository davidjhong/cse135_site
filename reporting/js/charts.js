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
    const dateFormatter = d3.timeFormat("%m/%d %H:%M:%S");
    const thresholdMs = 1000;

    const loadEvents = events
        .filter(d => d.event_type === 'page_load' && d.raw_data?.performance?.totalLoadTime !== undefined)
        .map(d => ({
            id: d.id,
            time: Number(d.raw_data.performance.totalLoadTime),
            createdAt: d.created_at ? new Date(d.created_at) : null
        }))
        .filter(d => Number.isFinite(d.time))
        .map(d => ({
            ...d,
            timeLabel: d.createdAt && !Number.isNaN(d.createdAt.getTime())
                ? dateFormatter(d.createdAt)
                : `Event ${d.id}`
        })).reverse(); // Reverse so oldest is on the left

    const chartContainer = d3.select("#performance-chart");
    chartContainer.style("position", "relative");
    chartContainer.html("");

    if (loadEvents.length === 0) {
        document.getElementById('performance-chart').innerHTML = '<p>No performance data available.</p>';
        return;
    }

    // 2. Setup SVG dimensions
    const width = 560, height = 320, margin = {top: 20, right: 20, bottom: 95, left: 85};
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const tooltip = chartContainer.append("div")
        .style("position", "absolute")
        .style("pointer-events", "none")
        .style("background", "rgba(0, 0, 0, 0.85)")
        .style("color", "#fff")
        .style("padding", "6px 8px")
        .style("border-radius", "4px")
        .style("font-size", "12px")
        .style("line-height", "1.3")
        .style("opacity", 0);

    const svg = chartContainer.append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // 3. Scales
    const x = d3.scaleBand().domain(loadEvents.map(d => d.id)).range([0, innerWidth]).padding(0.1);
    const y = d3.scaleLinear()
        .domain([0, Math.max(d3.max(loadEvents, d => d.time) * 1.2, thresholdMs * 1.1)])
        .range([innerHeight, 0]);

    const timeLabelById = new Map(loadEvents.map(d => [d.id, d.timeLabel]));
    const tickStep = Math.max(1, Math.ceil(loadEvents.length / 8));
    const xTickValues = loadEvents
        .map((d, index) => ({ id: d.id, index }))
        .filter(d => d.index % tickStep === 0 || d.index === loadEvents.length - 1)
        .map(d => d.id);

    // 4. Draw Bars
    svg.selectAll(".bar")
        .data(loadEvents)
        .enter().append("rect")
        .attr("class", "bar")
        .attr("x", d => x(d.id))
        .attr("y", d => y(d.time))
        .attr("width", x.bandwidth())
        .attr("height", d => innerHeight - y(d.time))
        .attr("fill", d => d.time > thresholdMs ? "#dc3545" : "#28a745") // Red if slow, Green if fast
        .on("mouseenter", function (event, d) {
            d3.select(this).attr("opacity", 0.8);
            tooltip
                .style("opacity", 1)
                .html(`Time: ${Math.round(d.time)} ms<br>${d.timeLabel}`);
        })
        .on("mousemove", function (event) {
            const [mouseX, mouseY] = d3.pointer(event, chartContainer.node());
            tooltip
                .style("left", `${mouseX + 12}px`)
                .style("top", `${mouseY - 28}px`);
        })
        .on("mouseleave", function () {
            d3.select(this).attr("opacity", 1);
            tooltip.style("opacity", 0);
        });

    // 5. Axes & Threshold Line
    svg.append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(
            d3.axisBottom(x)
                .tickValues(xTickValues)
                .tickFormat(d => timeLabelById.get(d) || "")
        )
        .selectAll("text")
        .style("text-anchor", "end")
        .attr("dx", "-0.5em")
        .attr("dy", "0.3em")
        .attr("transform", "rotate(-35)");

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
        .attr("y", -65)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .style("fill", "#333")
        .text("Load Time (ms)");
    
    // 1000ms SLA Line + Label
    svg.append("line")
        .attr("class", "threshold-line")
        .attr("x1", 0).attr("x2", innerWidth)
        .attr("y1", y(thresholdMs)).attr("y2", y(thresholdMs))
        .attr("stroke", "#6c757d")
        .attr("stroke-width", 1.5)
        .attr("stroke-dasharray", "4,4");

    svg.append("text")
        .attr("x", innerWidth - 4)
        .attr("y", y(thresholdMs) - 6)
        .attr("text-anchor", "end")
        .style("font-size", "11px")
        .style("fill", "#6c757d")
        .text(`SLA: ${thresholdMs} ms`);
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