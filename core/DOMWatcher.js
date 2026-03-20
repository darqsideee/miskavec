// ============================================
// DOMWatcher — MutationObserver wrapper
// Detects DOM changes: new questions, level
// transitions, score updates, feedback messages.
// ============================================
class DOMWatcher {

    constructor() {
        this._observers = [];
        this._listeners = new Map();
        this._lastContentHash = '';
        this._watching = false;
    }

    /**
     * Register an event listener.
     * @param {'questionChanged'|'levelComplete'|'error'|'scoreUpdate'|'domChange'} event
     * @param {Function} callback
     */
    on(event, callback) {
        if (!this._listeners.has(event)) {
            this._listeners.set(event, []);
        }
        this._listeners.get(event).push(callback);
    }

    _emit(event, data = null) {
        const callbacks = this._listeners.get(event) || [];
        for (const cb of callbacks) {
            try { cb(data); } catch (e) {
                console.warn(`[DOMWatcher] Event handler error for '${event}':`, e);
            }
        }
    }

    /**
     * Start watching the DOM for changes.
     */
    start() {
        if (this._watching) return;
        this._watching = true;

        // --- Main content observer ---
        const contentObserver = new MutationObserver((mutations) => {
            this._handleMutations(mutations);
        });

        // Watch the entire body for child/subtree changes
        contentObserver.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
            attributeFilter: ['class', 'style', 'data-state', 'data-correct', 'disabled']
        });

        this._observers.push(contentObserver);

        // Initial content snapshot
        this._lastContentHash = this._getContentHash();

        console.log('[DOMWatcher] 🔍 Watching for DOM changes...');
    }

    /**
     * Stop all observers.
     */
    stop() {
        this._watching = false;
        for (const obs of this._observers) {
            obs.disconnect();
        }
        this._observers = [];
        console.log('[DOMWatcher] ⏹ Stopped watching.');
    }

    /**
     * Handle mutations from MutationObserver.
     */
    _handleMutations(mutations) {
        let hasSignificantChange = false;
        let hasClassChange = false;

        for (const mutation of mutations) {
            // Track added/removed nodes (question change)
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Check for feedback elements (correct/wrong indicators)
                        if (this._isFeedbackElement(node)) {
                            this._handleFeedback(node);
                        }
                        hasSignificantChange = true;
                    }
                }
            }

            // Track attribute changes
            if (mutation.type === 'attributes') {
                hasClassChange = true;
            }
        }

        if (hasSignificantChange) {
            // Debounce: check if actual content changed
            const newHash = this._getContentHash();
            if (newHash !== this._lastContentHash) {
                this._lastContentHash = newHash;
                this._emit('questionChanged');
                this._emit('domChange');
            }
        }

        if (hasClassChange) {
            this._emit('domChange');
        }
    }

    /**
     * Generate a simple hash of the current task content.
     */
    _getContentHash() {
        // Try multiple possible task area selectors
        const selectors = [
            '.board', '.task', '.question', '.exercise',
            '[class*="task"]', '[class*="question"]', '[class*="board"]',
            'main', '.content', '#app'
        ];
        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el) {
                return el.textContent.trim().substring(0, 200);
            }
        }
        return document.body.textContent.substring(0, 200);
    }

    /**
     * Check if a node is a feedback/result element.
     */
    _isFeedbackElement(node) {
        const text = (node.className || '') + ' ' + (node.id || '');
        return /correct|wrong|error|success|result|feedback|score/i.test(text);
    }

    /**
     * Handle feedback elements (correct/wrong answers).
     */
    _handleFeedback(node) {
        const text = (node.className || '') + ' ' + (node.textContent || '');
        if (/correct|success|right|správn/i.test(text)) {
            this._emit('scoreUpdate', { correct: true });
        } else if (/wrong|error|incorrect|špatn/i.test(text)) {
            this._emit('scoreUpdate', { correct: false });
            this._emit('error', { node, message: 'Wrong answer detected' });
        }
    }

    /**
     * Wait for a content change (new question to appear).
     * @param {number} timeout
     * @returns {Promise<void>}
     */
    waitForChange(timeout = 15000) {
        return new Promise((resolve, reject) => {
            const handler = () => {
                clearTimeout(timer);
                resolve();
            };
            this.on('questionChanged', handler);
            const timer = setTimeout(() => {
                // Remove handler
                const handlers = this._listeners.get('questionChanged') || [];
                const idx = handlers.indexOf(handler);
                if (idx >= 0) handlers.splice(idx, 1);
                reject(new Error('[DOMWatcher] Timeout waiting for content change'));
            }, timeout);
        });
    }
}
