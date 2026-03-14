document.addEventListener('analyticsDataLoaded', (e) => {
    const rawEvents = e.detail;
    const analyticsUtils = window.AnalyticsUtils || {};

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

    const scopedEvents = typeof analyticsUtils.filterEventsLastDays === 'function'
        ? analyticsUtils.filterEventsLastDays(events, 30)
        : events;

    console.log(`[Analytics Scope] Using last 30 days window: ${scopedEvents.length}/${events.length} events`);

    if (document.getElementById("visitor-timeline-chart") && typeof window.drawVisitorTimelineChart === 'function') {
        window.drawVisitorTimelineChart(scopedEvents);
    }

    if (typeof window.populateBehaviorKPIs === 'function') {
        window.populateBehaviorKPIs(scopedEvents);
    }

    if (document.getElementById("most-visited-pages-chart") && typeof window.drawTopPageTransitionsChart === 'function') {
        window.drawTopPageTransitionsChart(scopedEvents);
    }

    if (document.getElementById("pageview-distribution-chart") && typeof window.drawPageviewDistributionChart === 'function') {
        window.drawPageviewDistributionChart(scopedEvents);
    }

    if (document.getElementById("device-category-chart") && typeof window.drawDeviceCategoryChart === 'function') {
        window.drawDeviceCategoryChart(scopedEvents);
    }

    if (document.getElementById("session-depth-chart") && typeof window.drawSessionDepthDistributionChart === 'function') {
        window.drawSessionDepthDistributionChart(scopedEvents);
    }

    if (document.getElementById("avg-interactions-chart") && typeof window.drawAvgInteractionsByPageChart === 'function') {
        window.drawAvgInteractionsByPageChart(scopedEvents);
    }

    if (document.getElementById("perf-trend-chart") && typeof window.drawPerformanceDashboard === 'function') {
        window.drawPerformanceDashboard(scopedEvents);
    }

    if (document.getElementById("error-rate-chart") && typeof window.drawErrorRateChart === 'function') {
        window.drawErrorRateChart(scopedEvents);
    }

    if (document.getElementById("reliability-type-chart") && typeof window.drawReliabilityDashboard === 'function') {
        window.drawReliabilityDashboard(scopedEvents);
    }
});