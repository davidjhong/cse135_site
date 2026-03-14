(function () {
    const VALID_PAGES = new Set([
        '/',
        '/index.html',
        '/index.php',
        '/products.html',
        '/products',
        '/product-detail.html',
        '/product-detail',
        '/checkout.html',
        '/checkout',
        '/liquidation.html',
        '/404.html'
    ]);

    const PAGE_LABELS = {
        '/': 'Home',
        '/index.html': 'Home',
        '/index.php': 'Home',
        '/products.html': 'Products',
        '/products': 'Products',
        '/product-detail.html': 'Product Detail',
        '/product-detail': 'Product Detail',
        '/checkout.html': 'Checkout',
        '/checkout': 'Checkout',
        '/liquidation.html': 'Liquidation',
        '/404.html': '404'
    };

    const CORE_PAGES = ['Home', 'Products', 'Product Detail', 'Checkout', 'Liquidation', '404'];

    function normalizePagePath(rawPath) {
        if (!rawPath) return '404';

        const cleanPath = String(rawPath).split('?')[0].split('#')[0];

        if (VALID_PAGES.has(cleanPath)) {
            return PAGE_LABELS[cleanPath] || cleanPath;
        }

        const trimmedPath = cleanPath.replace(/\/$/, '');
        if (VALID_PAGES.has(trimmedPath)) {
            return PAGE_LABELS[trimmedPath] || trimmedPath;
        }

        const withSlash = cleanPath.endsWith('/') ? cleanPath : cleanPath + '/';
        if (VALID_PAGES.has(withSlash)) {
            return PAGE_LABELS[withSlash] || withSlash;
        }

        return '404';
    }

    function extractPathFromUrl(url) {
        if (!url) return '/';

        try {
            const urlObj = new URL(url, window.location.origin);
            return urlObj.pathname || '/';
        } catch (e) {
            try {
                if (String(url).startsWith('/')) return String(url);
                return '/' + String(url);
            } catch (e2) {
                return '/';
            }
        }
    }

    function getEventPageLabel(event) {
        const pageUrl =
            event?.raw_data?.url ||
            event?.url ||
            event?.raw_data?.pageUrl ||
            event?.raw_data?.currentUrl ||
            event?.raw_data?.pathname ||
            '';

        if (!pageUrl) return null;

        const rawPath = extractPathFromUrl(pageUrl);
        return normalizePagePath(rawPath);
    }

    function parseEventTimestamp(event) {
        if (!event) return null;

        if (event.created_at) {
            const createdAt = String(event.created_at).replace(' ', 'T');
            const fromCreatedAt = new Date(createdAt);
            if (!Number.isNaN(fromCreatedAt.getTime())) return fromCreatedAt;
        }

        const payloadTimestamp = event.raw_data?.timestamp;
        if (typeof payloadTimestamp === 'number') {
            const fromNumericTs = new Date(payloadTimestamp);
            if (!Number.isNaN(fromNumericTs.getTime())) return fromNumericTs;
        }

        if (typeof payloadTimestamp === 'string') {
            const fromStringTs = new Date(payloadTimestamp);
            if (!Number.isNaN(fromStringTs.getTime())) return fromStringTs;
        }

        return null;
    }

    function toLocalDateKey(dateObj) {
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function getEventDateKey(event) {
        const createdAt = event?.created_at;
        if (createdAt) {
            const raw = String(createdAt).trim();
            if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
                return raw.substring(0, 10);
            }
        }

        const ts = parseEventTimestamp(event);
        if (!ts) return null;
        return toLocalDateKey(ts);
    }

    function filterEventsLastDays(events, days = 30, referenceDate = new Date()) {
        const source = Array.isArray(events) ? events : [];
        const safeDays = Math.max(1, Number(days) || 30);
        const ref = referenceDate instanceof Date ? new Date(referenceDate) : new Date();
        const end = new Date(ref);
        end.setDate(end.getDate() + 1);
        const endDateKey = toLocalDateKey(end);

        const start = new Date(ref);
        start.setHours(0, 0, 0, 0);
        start.setDate(start.getDate() - (safeDays - 1));
        const startDateKey = toLocalDateKey(start);

        return source.filter(event => {
            const eventDateKey = getEventDateKey(event);
            if (!eventDateKey) return false;
            return eventDateKey >= startDateKey && eventDateKey <= endDateKey;
        });
    }

    function getPercentile(arr, p) {
        if (!Array.isArray(arr) || arr.length === 0) return 0;
        const sorted = [...arr].sort((a, b) => a - b);
        const pos = (sorted.length - 1) * p;
        const base = Math.floor(pos);
        const rest = pos - base;
        if (sorted[base + 1] !== undefined) {
            return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
        }
        return sorted[base];
    }

    window.AnalyticsUtils = {
        VALID_PAGES,
        PAGE_LABELS,
        CORE_PAGES,
        normalizePagePath,
        extractPathFromUrl,
        getEventPageLabel,
        parseEventTimestamp,
        getEventDateKey,
        filterEventsLastDays,
        getPercentile
    };
})();
