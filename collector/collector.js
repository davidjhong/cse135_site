(function () {
    'use strict';

        const ENDPOINT = 'https://collector.davidjhong.site/api/collect.php';

    function getUID() {
        let match = document.cookie.match(new RegExp('(^| )_collector_uid=([^;]+)'));
        if (match) return match[2];
        let uid = crypto.randomUUID();
        document.cookie = `_collector_uid=${uid}; path=/; max-age=31536000; SameSite=Lax`;
        return uid;
    }

    // Temporary Cookie (Visit/Session)
    function getSID() {
        let match = document.cookie.match(new RegExp('(^| )_collector_sid=([^;]+)'));
        if (match) return match[2];
        let sid = crypto.randomUUID();
        document.cookie = `_collector_sid=${sid}; path=/; SameSite=Lax`;
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

    // ==========================================
    // FAILURE TRACKING
    // ==========================================

    // 1. Runtime JS Errors
    window.addEventListener('error', (e) => {
        // Distinguish between runtime errors and resource load errors
        if (e instanceof ErrorEvent) {
            // Runtime JavaScript error
            recordActivity('runtime_error', { 
                message: e.message, 
                line: e.lineno, 
                col: e.colno,
                filename: e.filename,
                errorType: e.error?.name || 'Unknown'
            });
        } else if (e.target && e.target !== window) {
            // Resource load error (image, script, stylesheet, etc.)
            const target = e.target;
            const resourceType = target.tagName?.toLowerCase() || 'unknown';
            const src = target.src || target.href || '';
            const statusCode = target.status || 0;
            
            recordActivity('broken_asset', {
                resourceType: resourceType,
                url: src,
                statusCode: statusCode
            });
        }
    }, true); // Use capture phase to catch resource errors

    // 2. Broken Assets - Explicit tracking for resource load failures
    function trackResourceLoadFailure(element, resourceType) {
        const src = element.src || element.href || '';
        if (src) {
            recordActivity('broken_asset', {
                resourceType: resourceType,
                url: src,
                statusCode: 0  // 0 indicates resource didn't load
            });
        }
    }

    // Images
    document.addEventListener('error', (e) => {
        if (e.target && e.target.tagName === 'IMG') {
            trackResourceLoadFailure(e.target, 'img');
        }
    }, true);

    // Scripts (via onerror)
    if (document.currentScript) {
        const scriptElements = document.querySelectorAll('script');
        scriptElements.forEach(script => {
            script.addEventListener('error', (e) => {
                trackResourceLoadFailure(e.target, 'script');
            });
        });
    }

    // 3. API Failures (Fetch interception)
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        const resource = args[0] instanceof Request ? args[0].url : args[0];
        const method = (args[1] && args[1].method) || 'GET';
        
        // Skip monitoring the analytics endpoint itself to avoid recursion
        const isAnalyticsEndpoint = resource && resource.includes('collect.php');
        
        return originalFetch.apply(this, args)
            .then(response => {
                // Log non-2xx responses (except for analytics endpoint)
                if (!response.ok && !isAnalyticsEndpoint) {
                    recordActivity('api_failure', {
                        url: response.url,
                        method: method,
                        statusCode: response.status,
                        statusText: response.statusText,
                        failureType: response.status === 404 ? '404_not_found' : 'api_failure'
                    });
                }
                return response;
            })
            .catch(error => {
                // Network error or other fetch failure (except for analytics endpoint)
                if (!isAnalyticsEndpoint) {
                    recordActivity('api_failure', {
                        url: resource,
                        method: method,
                        statusCode: 0,
                        statusText: error.message || 'Network Error',
                        failureType: 'api_failure'
                    });
                }
                throw error;
            });
    };

    // 4. XMLHttpRequest interception
    const originalXHR = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
        this._method = method;
        this._url = url;
        this._isAnalyticsEndpoint = url && url.includes('collect.php');
        
        const originalOnReadyStateChange = this.onreadystatechange;
        this.onreadystatechange = function() {
            if (this.readyState === 4) {  // Complete
                // Log failures only for non-2xx status codes (except analytics endpoint)
                const isError = this.status < 200 || this.status >= 300;
                if (isError && this.status !== 0 && !this._isAnalyticsEndpoint) {
                    recordActivity('api_failure', {
                        url: this._url,
                        method: this._method,
                        statusCode: this.status,
                        statusText: this.statusText,
                        failureType: this.status === 404 ? '404_not_found' : 'api_failure'
                    });
                }
            }
            if (originalOnReadyStateChange) {
                originalOnReadyStateChange.call(this);
            }
        };

        return originalXHR.call(this, method, url);
    };

    // Fallback for direct addEventListener on XHR
    const originalAddEventListener = XMLHttpRequest.prototype.addEventListener;
    XMLHttpRequest.prototype.addEventListener = function(event, handler) {
        if (event === 'error' || event === 'load') {
            const wrappedHandler = function(e) {
                if (!this._isAnalyticsEndpoint) {
                    if (event === 'error') {
                        recordActivity('api_failure', {
                            url: this._url,
                            method: this._method,
                            statusCode: 0,
                            statusText: 'Network Error',
                            failureType: 'api_failure'
                        });
                    } else if (event === 'load' && this.status !== 0) {
                        const isError = this.status < 200 || this.status >= 300;
                        if (isError) {
                            recordActivity('api_failure', {
                                url: this._url,
                                method: this._method,
                                statusCode: this.status,
                                statusText: this.statusText,
                                failureType: this.status === 404 ? '404_not_found' : 'api_failure'
                            });
                        }
                    }
                }
                return handler.call(this, e);
            };
            return originalAddEventListener.call(this, event, wrappedHandler);
        }
        return originalAddEventListener.call(this, event, handler);
    };

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
            session: getSID(),         
            user_id: getUID(),         // 1-year cookie ID
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

        // Use fetch with proper JSON content-type and CORS headers
        // The fetch interception checks _isAnalyticsEndpoint flag to prevent recursive monitoring
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