(function () {
    'use strict';

        const ENDPOINT = 'https://collector.davidjhong.site/api/collect.php';

    function getSessionID() {
        let match = document.cookie.match(new RegExp('(^| )_collector_sid=([^;]+)'));
        if (match) return match[2];

        let sid = crypto.randomUUID();

        document.cookie = `_collector_sid=${sid}; path=/`;

        return sid;
    }

    let imageTestResult = false; 
    let img = new Image();
    img.onload = function() { imageTestResult = true; };
    img.onerror = function() { imageTestResult = false; };
    img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

    function getStaticData() {
        let data = {
            userAgent: navigator.userAgent,
            language: navigator.language,
            cookiesEnabled: navigator.cookieEnabled,
            jsEnabled: true,

            screenWidth: window.screen.width,
            screenHeight: window.screen.height,
            windowWidth: window.innerWidth,
            windowHeight: window.innerHeight,

            networkType: ('connection' in navigator) ? navigator.connection.effectiveType : 'unknown',    
        };

        let testDiv = document.createElement('div');
        testDiv.style.height = '1px';
        document.body.appendChild(testDiv);
        data.cssEnabled = (window.getComputedStyle(testDiv).height === '1px');
        document.body.removeChild(testDiv);

        data.imagesEnabled = imageTestResult;

        return data;
    }

    function getPerformanceData() {
        const perfEntries = performance.getEntriesByType('navigation');
        
        if (perfEntries.length === 0) return {};

        const navEntry = perfEntries[0];

        return {
            timingObject: navEntry.toJSON(),
            loadStart: navEntry.fetchStart,
            loadEnd: navEntry.loadEventEnd,
            totalLoadTime: Math.round(navEntry.loadEventEnd - navEntry.fetchStart)
        };
    }

    //Activity
    let activityQueue = [];
    let idleTimeOut;
    let isIdle = false;
    let lastActivityTime = Date.now();

    function recordActivity(type, data) {
        const now = Date.now();

        if (isIdle) {
            const idleDuration = now - lastActivityTime;
            if (idleDuration > 2000) {
                activityQueue.push({ 
                    type: 'idle_end',
                    duration: idleDuration,
                    endedAt: now
                });
            }
            isIdle = false;
        }

        clearTimeout(idleTimeOut);
        idleTimeOut = setTimeout(() => {
            isIdle = true;
        }, 2000); // 2 seconds of inactivity triggers idle state

        lastActivityTime = now;

        activityQueue.push({
            type: type,
            timestamp: now,
            ...data
        }); 
    }

    // Errors
    window.addEventListener('error', (e) => {
        recordActivity('error', { message: e.message, line: e.lineno, col: e.colno });
    });

    // Clicks
    window.addEventListener('mousedown', (e) => {
    recordActivity('click', { button: e.button, x: e.clientX, y: e.clientY });
    });

    // Keyboard
    window.addEventListener('keydown', (e) => recordActivity('keydown', { key: e.key }));
    window.addEventListener('keyup', (e) => recordActivity('keyup', { key: e.key }));

    // Mouse movement
    let lastMouseMove = 0;
    window.addEventListener('mousemove', (e) => {
        if (Date.now() - lastMouseMove > 500) {
        recordActivity('mousemove', { x: e.clientX, y: e.clientY });
        lastMouseMove = Date.now();
        }
    });

    let lastScroll = 0;
    window.addEventListener('scroll', () => {
        if (Date.now() - lastScroll > 500) {
        recordActivity('scroll', { x: window.scrollX, y: window.scrollY });
        lastScroll = Date.now();
        }
    });

    function send(payloadType) {
        const payload = {
        session: getSessionID(),
        url: window.location.href,
        type: payloadType,
        timestamp: Date.now()
        };

        if (payloadType === 'page_load') {
            payload.static = getStaticData();
            payload.performance = getPerformanceData();
        } else if (payloadType === 'activity_update' || payloadType === 'page_exit') {
        if (activityQueue.length === 0 && payloadType !== 'page_exit') return;
            payload.activities = activityQueue.splice(0, activityQueue.length);
        }

        fetch(ENDPOINT, {
        method: 'POST', 
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        keepalive: true
        }).catch((err) => console.error("Analytics Delivery Error:", err));
    }

    // load
    window.addEventListener('load', () => {
        recordActivity('page_enter', {});
        setTimeout(() => send('page_load'), 100); 
    });

    // Send activity data every 5 secs
    setInterval(() => {
        send('activity_update');
    }, 5000);

    // exit
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            recordActivity('page_exit', {});
            send('page_exit');
        }
    });
})();