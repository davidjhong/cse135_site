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

    drawVisitorTimelineChart(events);
    drawDeviceCategoryChart(events);
});

function drawDeviceCategoryChart(events) {
    const chartContainer = d3.select("#activity-chart"); // Reusing the second container
    chartContainer.html("");
    chartContainer.style("position", "relative");

    // 1. Extract unique visitors (sessions) and determine device category
    const sessions = new Map();
    events.filter(d => d.event_type === 'page_load' && d.raw_data?.static).forEach(ev => {
        if (!sessions.has(ev.session_id)) {
            const ua = ev.raw_data.static.userAgent || "";
            const w = ev.raw_data.static.screenWidth || window.innerWidth;
            let device = 'desktop';
            
            if (/tablet|ipad|playbook|silk/i.test(ua)) device = 'tablet';
            else if (/mobile|iphone|ipod|android.*mobile/i.test(ua)) device = 'mobile';
            else if (/smart-tv|smarttv|tv/i.test(ua)) device = 'television';
            else if (w < 768) device = 'mobile';
            else if (w < 1024) device = 'tablet';
            
            sessions.set(ev.session_id, device);
        }
    });

    const counts = { mobile: 0, tablet: 0, desktop: 0, television: 0 };
    sessions.forEach(device => { if (counts[device] !== undefined) counts[device]++; });
    
    const totalVisitors = sessions.size;
    const data = Object.entries(counts).filter(([, val]) => val > 0).map(([key, value]) => ({ key, value }));

    if (totalVisitors === 0) {
        chartContainer.html('<p style="text-align:center;">No visitor data available.</p>');
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
        .style("text-align", "center")
        .style("color", "#6c757d")
        .style("font-size", "16px")
        .style("margin-bottom", "10px")
        .text("Visit by device category");

    // 3. Colors & Generators
    const colorMap = {
        "mobile": "#61a9f3", // Light blue
        "tablet": "#317fcf", // Dark blue
        "desktop": "#ef7b05", // Orange
        "television": "#f7c844" // Yellow
    };

    const pie = d3.pie().value(d => d.value).sort(null);
    const arc = d3.arc().innerRadius(radius * 0.6).outerRadius(radius);
    const outerArc = d3.arc().innerRadius(radius * 1.1).outerRadius(radius * 1.1);

    // Tooltip
    const tooltip = chartContainer.append("div")
        .style("position", "absolute")
        .style("pointer-events", "none")
        .style("background", "rgba(80, 80, 80, 0.95)")
        .style("color", "#fff")
        .style("padding", "10px")
        .style("border-radius", "4px")
        .style("font-size", "13px")
        .style("line-height", "1.4")
        .style("opacity", 0)
        .style("box-shadow", "0 2px 4px rgba(0,0,0,0.2)");

    // 4. Draw Slices
    svg.selectAll('allSlices')
        .data(pie(data))
        .enter()
        .append('path')
        .attr('d', arc)
        .attr('fill', d => colorMap[d.data.key])
        .attr("stroke", "white")
        .style("stroke-width", "2px")
        .on("mouseenter", function (event, d) {
            d3.select(this).style("opacity", 0.8);
            const percent = ((d.data.value / totalVisitors) * 100).toFixed(2);
            tooltip.style("opacity", 1)
                .html(`<div style="border-bottom: 1px solid #777; margin-bottom: 4px; padding-bottom: 2px;">${d.data.key}</div>
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

    // 5. Center Text (1500 Visitors)
    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "-0.1em")
        .style("font-size", "36px")
        .style("fill", "#8fa2b4")
        .text(totalVisitors);

    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "1.5em")
        .style("font-size", "14px")
        .style("fill", "#6c757d")
        .text("Visitors");

    // 6. External Lines & Labels
    svg.selectAll('allPolylines')
        .data(pie(data))
        .enter()
        .append('polyline')
        .attr("stroke", "#ccc")
        .style("fill", "none")
        .attr("stroke-width", 1)
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
        .style("font-size", "12px")
        .style("fill", "#555")
        .style("font-weight", "bold");

    // 7. Legend
    const legend = svg.append("g")
        .attr("transform", `translate(-${width/2.5}, ${height/2 - 5})`);
    
    let legendOffset = 0;
    const legendKeys = ["mobile", "tablet", "desktop", "television"];
    
    legendKeys.forEach(key => {
        const item = legend.append("g").attr("transform", `translate(${legendOffset}, 0)`);
        item.append("rect").attr("width", 12).attr("height", 12).attr("fill", colorMap[key]);
        item.append("text").attr("x", 18).attr("y", 10).text(key).style("font-size", "13px").style("fill", "#6c757d");
        legendOffset += 70 + (key.length * 5); // Dynamic spacing
    });
}

function drawVisitorTimelineChart(events) {
    const chartContainer = d3.select("#performance-chart"); // Reusing the first container
    chartContainer.html("");
    chartContainer.style("position", "relative");

    // 1. Group unique visitors by Date
    const visitorsByDate = new Map();
    events.filter(d => d.event_type === 'page_load').forEach(ev => {
        const dateKey = new Date(ev.created_at).toISOString().split('T')[0];
        if (!visitorsByDate.has(dateKey)) visitorsByDate.set(dateKey, new Set());
        visitorsByDate.get(dateKey).add(ev.session_id);
    });

    const data = Array.from(visitorsByDate, ([date, sessions]) => ({
        date: new Date(date),
        visitors: sessions.size
    })).sort((a, b) => a.date - b.date);

    if (data.length === 0) {
        chartContainer.html('<p style="text-align:center;">No timeline data available.</p>');
        return;
    }

    // 2. Setup Dimensions
    const width = 560, height = 320, margin = {top: 40, right: 20, bottom: 30, left: 40};
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = chartContainer.append("svg")
        .attr("width", width).attr("height", height)
        .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // Title
    svg.append("text")
        .attr("x", innerWidth / 2)
        .attr("y", -15)
        .attr("text-anchor", "middle")
        .style("font-size", "16px")
        .style("fill", "#6c757d")
        .text("Visitors and New Visitors Timeline");

    // 3. Scales
    const x = d3.scaleTime().domain(d3.extent(data, d => d.date)).range([0, innerWidth]);
    const y = d3.scaleLinear().domain([0, d3.max(data, d => d.visitors) || 10]).range([innerHeight, 0]);

    // 4. Area Generator (Matching the light blue aesthetic)
    const area = d3.area()
        .x(d => x(d.date))
        .y0(innerHeight)
        .y1(d => y(d.visitors))
        .curve(d3.curveMonotoneX);

    svg.append("path")
        .datum(data)
        .attr("fill", "#9cd2ff") // Light blue area
        .attr("stroke", "#3ea1f4") // Darker blue line
        .attr("stroke-width", 2)
        .attr("d", area)
        .attr("opacity", 0.7);

    // 5. Axes
    svg.append("g").attr("transform", `translate(0,${innerHeight})`).call(d3.axisBottom(x).ticks(5));
    svg.append("g").call(d3.axisLeft(y).ticks(5));
}