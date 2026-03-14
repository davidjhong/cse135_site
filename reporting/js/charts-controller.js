document.addEventListener('analyticsDataLoaded', (e) => {
    const rawEvents = e.detail;

    // Parse JSON exactly once for all charts
    const events = rawEvents.map(ev => {
        let parsedData = {};
        if (ev.raw_data) {
            try { 
                parsedData = typeof ev.raw_data === 'string' ? JSON.parse(ev.raw_data) : ev.raw_data; 
            } catch (err) { 
                console.error("JSON Parse error on ID", ev.id); 
            }
        }
        return { ...ev, raw_data: parsedData };
    });

    if (document.getElementById("visitor-timeline-chart") && typeof window.drawVisitorTimelineChart === 'function') {
        window.drawVisitorTimelineChart(events);
    }

    if (document.getElementById("most-visited-pages-chart") && typeof window.drawTopPageTransitionsChart === 'function') {
        window.drawTopPageTransitionsChart(events);
    }

    if (document.getElementById("device-category-chart") && typeof window.drawDeviceCategoryChart === 'function') {
        window.drawDeviceCategoryChart(events);
    }

    if (document.getElementById("perf-trend-chart") && typeof window.drawPerformanceDashboard === 'function') {
        window.drawPerformanceDashboard(events);
    }

    if (document.getElementById("error-rate-chart") && typeof window.drawErrorRateChart === 'function') {
        window.drawErrorRateChart(events);
    }

    if (document.getElementById("reliability-type-chart") && typeof window.drawReliabilityDashboard === 'function') {
        window.drawReliabilityDashboard(events);
    }
});