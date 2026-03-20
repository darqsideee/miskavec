// ============================================
// BaseModule — Abstract base class for all
// game-solving modules.
// ============================================
class BaseModule {

    /**
     * @param {Humanizer} humanizer - Shared humanizer instance
     * @param {StateManager} stateManager - Shared state manager
     */
    constructor(humanizer, stateManager) {
        if (new.target === BaseModule) {
            throw new Error('BaseModule is abstract and cannot be instantiated directly');
        }
        this.humanizer = humanizer;
        this.stateManager = stateManager;
        this.name = 'BaseModule';
        this._active = false;
    }

    /**
     * Check if this module can handle the current DOM state.
     * Must be overridden by subclasses.
     * @returns {boolean}
     */
    canHandle() {
        throw new Error('canHandle() must be implemented by subclass');
    }

    /**
     * Solve the current task/question.
     * Must be overridden by subclasses.
     * @returns {Promise<boolean>} true if solved successfully
     */
    async solve() {
        throw new Error('solve() must be implemented by subclass');
    }

    /**
     * Get module-specific state.
     * @returns {Object}
     */
    getState() {
        return { name: this.name, active: this._active };
    }

    /**
     * Activate this module.
     */
    activate() {
        this._active = true;
        this.stateManager.setModule(this.name);
        console.log(
            `%c[${this.name}] 🚀 Module activated`,
            'color: #2196F3; font-weight: bold'
        );
    }

    /**
     * Deactivate this module.
     */
    deactivate() {
        this._active = false;
        console.log(`[${this.name}] Module deactivated`);
    }

    /**
     * Helper: extract question/task text from the page.
     * Tries multiple selectors common across umimeto.org.
     */
    _getQuestionText() {
        const selectors = [
            '.task-text', '.question-text', '.task h2', '.task h3',
            '.question', '.exercise-text', '.board .text',
            '.board h2', '.board h3', '.task p',
            '[class*="question"]', '[class*="task-text"]',
            '[class*="zadani"]', '[class*="priklad"]'
        ];

        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el) {
                const text = DOMHelpers.getTextContent(el);
                if (text.length > 0) return text;
            }
        }

        // Fallback: look for prominent text in the board/main area
        const board = document.querySelector('.board, main, .content, #app');
        if (board) {
            const headers = board.querySelectorAll('h1, h2, h3, h4, p, .text');
            for (const h of headers) {
                const text = DOMHelpers.getTextContent(h);
                if (text.length > 2 && text.length < 500) return text;
            }
        }

        return '';
    }

    /**
     * Helper: wait for the next question to load.
     * @param {number} timeout
     */
    async _waitForNextQuestion(timeout = 5000) {
        await this.humanizer.wait(500, 1500);
        try {
            await DOMHelpers.waitForElement('.task, .question, .board, .exercise', timeout);
        } catch {
            // Timeout is okay — question might already be there
        }
    }

    /**
     * Helper: detect if the current question shows a result/feedback.
     */
    _hasFeedback() {
        const selectors = [
            '.feedback', '.result', '[class*="feedback"]',
            '[class*="result"]', '.correct', '.wrong',
            '[class*="correct"]', '[class*="wrong"]',
            '[class*="success"]', '[class*="error"]'
        ];
        for (const sel of selectors) {
            if (document.querySelector(sel)) return true;
        }
        return false;
    }

    /**
     * Helper: click a "next" or "continue" button if present.
     */
    async _clickNext() {
        const nextSelectors = [
            'button.next', 'button[class*="next"]',
            '.next-button', '.continue-button',
            'button[class*="continue"]', 'button[class*="dalsi"]',
            '.btn-next', '#next-btn',
            'button.btn-primary'
        ];

        for (const sel of nextSelectors) {
            const btn = document.querySelector(sel);
            if (btn && DOMHelpers.isVisible(btn)) {
                await this.humanizer.clickElement(btn);
                return true;
            }
        }

        // Try buttons containing "Další" or "Pokračovat" text
        const allButtons = DOMHelpers.getVisibleElements('button, a.btn, [role="button"]');
        for (const btn of allButtons) {
            const text = DOMHelpers.getTextContent(btn).toLowerCase();
            if (text.includes('další') || text.includes('pokračovat') || text.includes('next') || text.includes('znovu')) {
                await this.humanizer.clickElement(btn);
                return true;
            }
        }

        return false;
    }
}
