// ============================================
// CanvasInterceptor — Hooks canvas text drawing
// to capture fraction values BEFORE they become
// blob images. This is the key to reading
// umimeto.org's image-based card content.
//
// Pipeline: fillText("1/3") → canvas.toBlob() → URL.createObjectURL()
// We intercept all 3 steps to build: blobURL → text mapping.
// ============================================
class CanvasInterceptor {

    constructor() {
        // Map: blobURL → array of text strings drawn on that canvas
        this._blobTextMap = new Map();

        // Temporary: current canvas → array of drawn texts
        this._canvasTexts = new WeakMap();

        // All captured texts (ordered by capture time)
        this._allTexts = [];

        // Track last N drawn texts for matching
        this._recentTexts = [];

        this._installed = false;
    }

    /**
     * Install all hooks. Call BEFORE exercise loads.
     */
    install() {
        if (this._installed) return;
        this._installed = true;

        this._hookFillText();
        this._hookToBlob();
        this._hookToDataURL();
        this._hookCreateObjectURL();

        console.log('[CanvasInterceptor] 🎨 Installed canvas hooks (fillText → toBlob → createObjectURL)');
    }

    /**
     * Hook CanvasRenderingContext2D.fillText and strokeText
     * to capture every text drawn on any canvas.
     */
    _hookFillText() {
        const self = this;

        const origFillText = CanvasRenderingContext2D.prototype.fillText;
        CanvasRenderingContext2D.prototype.fillText = function (text, x, y, ...rest) {
            self._recordText(this.canvas, String(text));
            return origFillText.call(this, text, x, y, ...rest);
        };

        const origStrokeText = CanvasRenderingContext2D.prototype.strokeText;
        CanvasRenderingContext2D.prototype.strokeText = function (text, x, y, ...rest) {
            self._recordText(this.canvas, String(text));
            return origStrokeText.call(this, text, x, y, ...rest);
        };
    }

    /**
     * Hook canvas.toBlob() to associate canvas text with the resulting blob.
     */
    _hookToBlob() {
        const self = this;
        const origToBlob = HTMLCanvasElement.prototype.toBlob;

        HTMLCanvasElement.prototype.toBlob = function (callback, ...rest) {
            const texts = self._canvasTexts.get(this) || [];
            const wrappedCallback = function (blob) {
                if (blob && texts.length > 0) {
                    // Store: blob → texts (will be mapped to URL in createObjectURL)
                    self._pendingBlobs = self._pendingBlobs || new WeakMap();
                    self._pendingBlobs.set(blob, [...texts]);
                }
                callback(blob);
            };
            return origToBlob.call(this, wrappedCallback, ...rest);
        };
    }

    /**
     * Hook canvas.toDataURL() as alternative to toBlob.
     */
    _hookToDataURL() {
        const self = this;
        const origToDataURL = HTMLCanvasElement.prototype.toDataURL;

        HTMLCanvasElement.prototype.toDataURL = function (...rest) {
            const url = origToDataURL.call(this, ...rest);
            const texts = self._canvasTexts.get(this) || [];
            if (texts.length > 0) {
                self._blobTextMap.set(url, [...texts]);
            }
            return url;
        };
    }

    /**
     * Hook URL.createObjectURL to associate blob URLs with captured text.
     */
    _hookCreateObjectURL() {
        const self = this;
        const origCreateObjectURL = URL.createObjectURL;

        URL.createObjectURL = function (obj) {
            const url = origCreateObjectURL.call(this, obj);

            // Check if this blob has associated text from canvas
            if (self._pendingBlobs && obj instanceof Blob) {
                const texts = self._pendingBlobs.get(obj);
                if (texts && texts.length > 0) {
                    self._blobTextMap.set(url, texts);
                    console.log(`[CanvasInterceptor] 🎯 Mapped: ${url.substring(0, 60)}... → "${texts.join(', ')}"`);
                }
            }

            return url;
        };
    }

    /**
     * Record text drawn on a canvas.
     */
    _recordText(canvas, text) {
        if (!text || text.trim().length === 0) return;
        text = text.trim();

        // Store per-canvas
        if (!this._canvasTexts.has(canvas)) {
            this._canvasTexts.set(canvas, []);
        }
        this._canvasTexts.get(canvas).push(text);

        // Store globally
        this._allTexts.push({ text, time: Date.now() });
        this._recentTexts.push(text);

        // Keep recent list bounded
        if (this._recentTexts.length > 100) {
            this._recentTexts = this._recentTexts.slice(-50);
        }
    }

    /**
     * Look up text content for a blob URL (card image src).
     * @param {string} blobUrl - The blob: URL from the img src
     * @returns {string|null} - The text drawn on the canvas, or null
     */
    getTextForBlobUrl(blobUrl) {
        const texts = this._blobTextMap.get(blobUrl);
        if (texts && texts.length > 0) {
            // Join all texts drawn on this canvas (usually just one for a fraction)
            return texts.join('');
        }
        return null;
    }

    /**
     * Get text for a card element by reading its img src.
     * @param {Element} cardElement
     * @returns {string|null}
     */
    getTextForCard(cardElement) {
        const img = cardElement.querySelector('img');
        if (!img) return null;
        const src = img.src || img.getAttribute('src');
        if (!src) return null;
        return this.getTextForBlobUrl(src);
    }

    /**
     * Get all captured texts (ordered by draw time).
     * Useful for matching when blob URL mapping fails.
     */
    getAllTexts() {
        return this._allTexts.map(t => t.text);
    }

    /**
     * Get the most recent N texts (for current question's cards).
     * @param {number} n - How many texts to retrieve
     */
    getRecentTexts(n) {
        return this._recentTexts.slice(-n);
    }

    /**
     * Get all blob URL → text mappings (for debugging).
     */
    getAllMappings() {
        const result = {};
        for (const [url, texts] of this._blobTextMap) {
            result[url.substring(0, 60)] = texts;
        }
        return result;
    }

    /**
     * Clear recent texts (call when moving to a new question).
     */
    clearRecent() {
        this._recentTexts = [];
    }

    /**
     * Get total count of intercepted texts.
     */
    get interceptedCount() {
        return this._allTexts.length;
    }

    /**
     * Get count of blob URL mappings.
     */
    get mappingCount() {
        return this._blobTextMap.size;
    }
}
