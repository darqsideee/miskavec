// ============================================
// NetworkInterceptor — Hooks fetch/XHR to capture
// exercise data from the umimeto.org API before
// it gets rendered as blob images.
//
// Also scans the page's JS scope for exercise
// data objects.
// ============================================
class NetworkInterceptor {

    constructor() {
        this._capturedData = [];
        this._exerciseItems = [];
        this._installed = false;
    }

    /**
     * Install hooks on fetch and XMLHttpRequest.
     * Must be called EARLY, before exercises load.
     */
    install() {
        if (this._installed) return;
        this._installed = true;

        this._hookFetch();
        this._hookXHR();

        console.log('[NetworkInterceptor] 🌐 Installed fetch/XHR hooks');
    }

    /**
     * Hook window.fetch to capture responses.
     */
    _hookFetch() {
        const self = this;
        const origFetch = window.fetch;

        window.fetch = function (...args) {
            return origFetch.apply(this, args).then(response => {
                // Clone and read the response body
                const clone = response.clone();
                clone.text().then(body => {
                    self._processResponse(args[0]?.toString?.() || args[0], body);
                }).catch(() => { });
                return response;
            });
        };
    }

    /**
     * Hook XMLHttpRequest to capture responses.
     */
    _hookXHR() {
        const self = this;
        const origOpen = XMLHttpRequest.prototype.open;
        const origSend = XMLHttpRequest.prototype.send;

        XMLHttpRequest.prototype.open = function (method, url, ...rest) {
            this._interceptUrl = url;
            return origOpen.call(this, method, url, ...rest);
        };

        XMLHttpRequest.prototype.send = function (...args) {
            this.addEventListener('load', function () {
                try {
                    self._processResponse(this._interceptUrl, this.responseText);
                } catch { }
            });
            return origSend.apply(this, args);
        };
    }

    /**
     * Process a captured response — look for exercise data.
     */
    _processResponse(url, body) {
        if (!body || body.length < 5) return;

        try {
            const data = JSON.parse(body);
            this._capturedData.push({ url, data, time: Date.now() });

            // Search for exercise items in the response
            const items = this._findExerciseItems(data);
            if (items.length > 0) {
                console.log(`[NetworkInterceptor] 📊 Found ${items.length} exercise items from: ${url}`);
                this._exerciseItems = items;
            }
        } catch {
            // Not JSON, ignore
        }
    }

    /**
     * Recursively search an object for arrays that look like exercise items.
     * Exercise items typically have properties like: value, expr, text, answer,
     * position, index, fraction, number, etc.
     */
    _findExerciseItems(obj, depth = 0) {
        if (depth > 8 || !obj) return [];

        // If it's an array of objects, check if they look like exercise items
        if (Array.isArray(obj) && obj.length >= 2) {
            const hasExerciseProps = obj.every(item =>
                typeof item === 'object' && item !== null
            );
            if (hasExerciseProps) {
                // Check for common exercise data properties
                const sampleKeys = Object.keys(obj[0] || {}).join(',').toLowerCase();
                if (sampleKeys.match(/val|expr|text|answer|pos|frac|num|content|item|correct|label|name/)) {
                    console.log(`[NetworkInterceptor] Candidate array found: keys=[${Object.keys(obj[0]).join(',')}], length=${obj.length}`);
                    return obj;
                }
            }
        }

        // Recurse into object properties
        if (typeof obj === 'object' && obj !== null) {
            for (const key of Object.keys(obj)) {
                const result = this._findExerciseItems(obj[key], depth + 1);
                if (result.length > 0) return result;
            }
        }

        return [];
    }

    /**
     * Get the most recently captured exercise items.
     */
    getExerciseItems() {
        return this._exerciseItems;
    }

    /**
     * Get all captured data (for debugging).
     */
    getAllCaptured() {
        return this._capturedData;
    }

    /**
     * Try to find exercise data from the page's JavaScript state.
     * Searches global variables and element properties.
     */
    static scanPageState() {
        const results = { items: [], source: '' };

        // Strategy 1: Search window properties for exercise data
        const ignoreKeys = new Set([
            'chrome', 'document', 'location', 'navigator', 'performance',
            'screen', 'history', 'localStorage', 'sessionStorage', 'caches',
            'cookieStore', 'crypto', 'indexedDB', 'fetch', 'alert', 'console',
            'frames', 'parent', 'self', 'top', 'window', 'solver', 'umime'
        ]);

        for (const key of Object.keys(window)) {
            if (ignoreKeys.has(key)) continue;
            try {
                const val = window[key];
                if (val && typeof val === 'object' && !Array.isArray(val)) {
                    // Look for objects with arrays of items
                    for (const subKey of Object.keys(val)) {
                        const subVal = val[subKey];
                        if (Array.isArray(subVal) && subVal.length >= 2) {
                            const sample = subVal[0];
                            if (sample && typeof sample === 'object') {
                                const keys = Object.keys(sample).join(',').toLowerCase();
                                if (keys.match(/val|expr|text|answer|pos|frac|num|content|item|label/)) {
                                    results.items = subVal;
                                    results.source = `window.${key}.${subKey}`;
                                    console.log(`[NetworkInterceptor] 🔍 Found data in ${results.source}: ${JSON.stringify(subVal).substring(0, 200)}`);
                                    return results;
                                }
                            }
                        }
                    }
                }
                // Check arrays directly
                if (Array.isArray(val) && val.length >= 2) {
                    const sample = val[0];
                    if (sample && typeof sample === 'object') {
                        const keys = Object.keys(sample).join(',').toLowerCase();
                        if (keys.match(/val|expr|text|answer|pos|frac|num|content|item|label/)) {
                            results.items = val;
                            results.source = `window.${key}`;
                            console.log(`[NetworkInterceptor] 🔍 Found data in ${results.source}`);
                            return results;
                        }
                    }
                }
            } catch { }
        }

        // Strategy 2: Search script tag contents for JSON data
        const scripts = document.querySelectorAll('script:not([src])');
        for (const script of scripts) {
            const text = script.textContent;
            // Look for JSON-like data embedded in scripts
            const jsonMatches = text.match(/\[[\s\S]*?\{[\s\S]*?"(?:val|expr|text|items?|frac)[\s\S]*?\}[\s\S]*?\]/g);
            if (jsonMatches) {
                for (const match of jsonMatches) {
                    try {
                        const parsed = JSON.parse(match);
                        if (Array.isArray(parsed) && parsed.length >= 2) {
                            results.items = parsed;
                            results.source = 'inline script';
                            return results;
                        }
                    } catch { }
                }
            }
        }

        return results;
    }

    /**
     * Try to read card data from React/Vue internal state.
     */
    static readComponentState(element) {
        if (!element) return null;

        // React fiber
        const reactKey = Object.keys(element).find(k =>
            k.startsWith('__reactFiber$') ||
            k.startsWith('__reactInternalInstance$') ||
            k.startsWith('__reactProps$')
        );
        if (reactKey) {
            try {
                const fiber = element[reactKey];
                const props = fiber?.memoizedProps || fiber?.pendingProps || fiber;
                if (props) {
                    console.log(`[NetworkInterceptor] ⚛️ React props:`, props);
                    return props;
                }
            } catch { }
        }

        // Vue
        if (element.__vue__) {
            try {
                const vm = element.__vue__;
                console.log(`[NetworkInterceptor] 🟢 Vue data:`, vm.$data || vm._data);
                return vm.$data || vm._data;
            } catch { }
        }

        // Angular
        const ngKey = Object.keys(element).find(k => k.startsWith('__ng'));
        if (ngKey) {
            console.log(`[NetworkInterceptor] 🔴 Angular data:`, element[ngKey]);
            return element[ngKey];
        }

        return null;
    }
}
