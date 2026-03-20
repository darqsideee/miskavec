// ============================================
// BaseModule — Abstract base class for all
// game-solving modules.
// Tailored to umimeto.org / umimematiku.cz
// ============================================
class BaseModule {

    /**
     * @param {Humanizer} humanizer
     * @param {StateManager} stateManager
     */
    constructor(humanizer, stateManager) {
        if (new.target === BaseModule) {
            throw new Error('BaseModule is abstract');
        }
        this.humanizer = humanizer;
        this.stateManager = stateManager;
        this.name = 'BaseModule';
        this._active = false;
    }

    canHandle() { throw new Error('canHandle() must be implemented'); }
    async solve() { throw new Error('solve() must be implemented'); }

    getState() { return { name: this.name, active: this._active }; }

    activate() {
        this._active = true;
        this.stateManager.setModule(this.name);
        console.log(`%c[${this.name}] 🚀 Module activated`, 'color: #2196F3; font-weight: bold');
    }

    deactivate() {
        this._active = false;
    }

    // ── umimeto-specific helpers ─────────────────

    /**
     * Extract question/task text from the page.
     * Tries umimeto-specific selectors first.
     */
    _getQuestionText() {
        const selectors = [
            '.task-text', '.question-text',
            '.content-box .text', '.content-box p',
            '.exercise-header + div', '.exercise-header ~ div',
            'h2', 'h3',
            '.label'
        ];

        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el) {
                const text = DOMHelpers.getTextContent(el);
                if (text.length > 2 && text.length < 500) return text;
            }
        }

        // Fallback: gather visible text near the game area
        const body = document.querySelector('.content-box, main, body');
        if (body) {
            const elements = body.querySelectorAll('h1, h2, h3, h4, p, .text, .label, span');
            for (const h of elements) {
                const text = DOMHelpers.getTextContent(h);
                if (text.length > 5 && text.length < 300) return text;
            }
        }
        return '';
    }

    /**
     * Click the "Vyhodnoť" (Evaluate) button.
     */
    async _clickEvaluate() {
        const btn = document.querySelector('#evaluate');
        if (btn && DOMHelpers.isVisible(btn)) {
            await this.humanizer.clickElement(btn);
            return true;
        }
        return false;
    }

    /**
     * Click the "Další »" (Next) button.
     */
    async _clickNext() {
        // Primary: #next button
        const nextBtn = document.querySelector('#next');
        if (nextBtn && DOMHelpers.isVisible(nextBtn)) {
            await this.humanizer.clickElement(nextBtn);
            return true;
        }

        // Fallback: any visible button with "Další" text
        const allButtons = DOMHelpers.getVisibleElements('button.tlacitko, button');
        for (const btn of allButtons) {
            const text = DOMHelpers.getTextContent(btn).toLowerCase();
            if (text.includes('další') || text.includes('pokračovat') || text.includes('next')) {
                await this.humanizer.clickElement(btn);
                return true;
            }
        }
        return false;
    }

    /**
     * Check if feedback (correct/wrong) is being shown.
     */
    _hasFeedback() {
        // On umimeto, after evaluation the #next button appears
        const nextBtn = document.querySelector('#next');
        if (nextBtn && DOMHelpers.isVisible(nextBtn)) return true;

        // Also check for answer highlighting
        const highlighted = document.querySelector('.correct, .wrong, .error, .success, [data-state="correct"], [data-state="wrong"]');
        return !!highlighted;
    }

    /**
     * Check if "Další" button is visible (means we're between questions).
     */
    _isNextVisible() {
        const btn = document.querySelector('#next');
        return btn && DOMHelpers.isVisible(btn);
    }

    /**
     * Check if "Vyhodnoť" button is visible (means we can submit).
     */
    _isEvaluateVisible() {
        const btn = document.querySelector('#evaluate');
        return btn && DOMHelpers.isVisible(btn);
    }

    /**
     * Wait for next question to appear.
     */
    async _waitForNextQuestion(timeout = 5000) {
        await this.humanizer.wait(500, 1500);
    }

    /**
     * Read data-expr attribute from an element.
     */
    _getExpr(element) {
        return element?.dataset?.expr || element?.getAttribute('data-expr') || '';
    }

    /**
     * Read data-index attribute from an element.
     */
    _getIndex(element) {
        return element?.dataset?.index || element?.getAttribute('data-index') || '';
    }
}
