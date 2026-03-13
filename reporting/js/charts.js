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
        .attr("class", "chart-tooltip device-tooltip");

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
    const chartContainer = d3.select("#performance-chart");
    chartContainer.html("");
    chartContainer.style("position", "relative");

    // 1. Process data for Pageviews, Visitors, and New Visitors
    const dailyStats = new Map();
    const sessionFirstDate = new Map();

    events.forEach(ev => {
        if (!ev.created_at) return;
        const dateKey = ev.created_at.split(' ')[0];
        if (!sessionFirstDate.has(ev.session_id) || dateKey < sessionFirstDate.get(ev.session_id)) {
            sessionFirstDate.set(ev.session_id, dateKey);
        }
    });

    events.filter(d => d.event_type === 'page_load').forEach(ev => {
        if (!ev.created_at) return;
        const dateKey = ev.created_at.split(' ')[0];
        if (!dailyStats.has(dateKey)) {
            dailyStats.set(dateKey, { 
                date: new Date(dateKey + 'T00:00:00'), 
                visitorsSet: new Set(),
                pageviews: 0 
            });
        }
        dailyStats.get(dateKey).visitorsSet.add(ev.session_id);
        dailyStats.get(dateKey).pageviews++;
    });

    const data = Array.from(dailyStats.values()).map(stat => {
        let newVisCount = 0;
        const currentDateStr = stat.date.toISOString().split('T')[0];
        
        stat.visitorsSet.forEach(sid => {
            if (sessionFirstDate.get(sid) === currentDateStr) {
                newVisCount++;
            }
        });

        return {
            date: stat.date,
            pageviews: stat.pageviews,
            visitors: stat.visitorsSet.size,
            newVisitors: newVisCount
        };
    }).sort((a, b) => a.date - b.date);

    if (data.length === 0) {
        chartContainer.html('<p class="chart-empty-state">No timeline data available.</p>');
        return;
    }

    const totalViews = d3.sum(data, d => d.pageviews);
    const totalVis = d3.sum(data, d => d.visitors);
    const totalNew = d3.sum(data, d => d.newVisitors);

    // 2. Setup Dimensions
    const width = 560, height = 350;
    const margin = {top: 70, right: 20, bottom: 30, left: 40};
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = chartContainer.append("svg")
        .attr("width", width).attr("height", height)
        .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // Top Title
    chartContainer.insert("div", ":first-child")
        .attr("class", "chart-title")
        .text(`Traffic Overview (${totalViews} Views / ${totalVis} Vis / ${totalNew} New)`);

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
            <span class="legend-item"><span class="legend-color legend-vis"></span> Visitors: ${d.visitors}</span>
            <span class="legend-item"><span class="legend-color legend-new"></span> New Visitors: ${d.newVisitors}</span>
        `);
    };
    updateLegend(data[data.length - 1]);

    const tooltip = chartContainer.append("div")
        .attr("class", "chart-tooltip");

    // 3. Scales (Y-axis now scales based on Pageviews, since it's the largest number)
    const x = d3.scaleTime().domain(d3.extent(data, d => d.date)).range([0, innerWidth]);
    const yMax = Math.max(d3.max(data, d => d.pageviews) || 5, 5);
    const y = d3.scaleLinear().domain([0, yMax]).range([innerHeight, 0]);

    // 4. Area Generators
    const areaPageviews = d3.area().x(d => x(d.date)).y0(innerHeight).y1(d => y(d.pageviews)).curve(d3.curveMonotoneX);
    const areaVisitors = d3.area().x(d => x(d.date)).y0(innerHeight).y1(d => y(d.visitors)).curve(d3.curveMonotoneX);
    const areaNewVisitors = d3.area().x(d => x(d.date)).y0(innerHeight).y1(d => y(d.newVisitors)).curve(d3.curveMonotoneX);

    // Draw Areas (Back to Front: Pageviews -> Visitors -> New Visitors)
    svg.append("path")
        .datum(data)
        .attr("class", "area-pageviews")
        .attr("d", areaPageviews);

    svg.append("path")
        .datum(data)
        .attr("class", "area-visitors")
        .attr("d", areaVisitors);

    svg.append("path")
        .datum(data)
        .attr("class", "area-new-visitors")
        .attr("d", areaNewVisitors);

    // 5. Axes
    svg.append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .attr("class", "chart-axis")
        .call(d3.axisBottom(x).ticks(5).tickFormat(d3.timeFormat("%b %d")));

    svg.append("g")
        .attr("class", "chart-axis")
        .call(d3.axisLeft(y).ticks(5));

    // 6. Interactive Hover Line
    const hoverLine = svg.append("line")
        .attr("class", "hover-line")
        .attr("y1", 0).attr("y2", innerHeight);

    const bisectDate = d3.bisector(d => d.date).left;

    svg.append("rect")
        .attr("width", innerWidth).attr("height", innerHeight)
        .attr("fill", "none").attr("pointer-events", "all")
        .on("mouseover", () => {
            hoverLine.style("opacity", 1);
            tooltip.style("opacity", 1);
        })
        .on("mouseout", () => {
            hoverLine.style("opacity", 0);
            tooltip.style("opacity", 0);
            updateLegend(data[data.length - 1]);
        })
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
                Visitors: ${d.visitors}<br>
                New Visitors: ${d.newVisitors}
            `);

            let tipX = cx + margin.left + 15;
            if (tipX + 120 > width) tipX = cx + margin.left - 130;
            tooltip.style("left", `${tipX}px`).style("top", `${margin.top + y(d.pageviews) / 2}px`);

            updateLegend(d);
        });
}