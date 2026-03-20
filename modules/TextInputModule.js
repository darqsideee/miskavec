// ============================================
// TextInputModule — Module A
// Solves "Psaná odpověď" (Written Answer) tasks
// Extracts question, computes answer, types it in.
// ============================================
class TextInputModule extends BaseModule {

    constructor(humanizer, stateManager) {
        super(humanizer, stateManager);
        this.name = 'TextInputModule';
        this._inputSelectors = [
            'input.answer', 'input[name="answer"]',
            'input[type="text"][class*="answer"]',
            'input[type="number"][class*="answer"]',
            '.task input[type="text"]',
            '.task input[type="number"]',
            '.exercise input[type="text"]',
            'input.form-control',
            '#answer-input',
            'input[data-answer]',
            '.board input[type="text"]',
            '.board input[type="number"]',
            'input:not([type="hidden"]):not([type="submit"])'
        ];
        this._submitSelectors = [
            'button[type="submit"]', 'input[type="submit"]',
            'button.submit', 'button[class*="submit"]',
            'button[class*="check"]', 'button[class*="answer"]',
            '.submit-button', '#submit-btn',
            'button.btn-primary',
            'button[class*="zkontrolovat"]',
            'button[class*="odeslat"]',
            'button[class*="potvrdit"]'
        ];
    }

    canHandle() {
        for (const sel of this._inputSelectors) {
            try {
                const inputs = DOMHelpers.getVisibleElements(sel);
                if (inputs.length > 0) return true;
            } catch { }
        }
        return false;
    }

    async solve() {
        try {
            // 1. Find the input field
            const input = this._findInput();
            if (!input) {
                console.warn(`[${this.name}] Could not find input field`);
                return false;
            }

            // 2. Extract the question text
            const questionText = this._getQuestionText();
            if (!questionText) {
                console.warn(`[${this.name}] Could not extract question text`);
                return false;
            }

            console.log(`[${this.name}] 📝 Question: "${questionText}"`);

            // 3. Solve the math
            const answer = this._computeAnswer(questionText, input);
            if (answer === null) {
                console.warn(`[${this.name}] Could not compute answer for: "${questionText}"`);
                return false;
            }

            console.log(`[${this.name}] 💡 Answer: ${answer}`);

            // 4. Human-like thinking delay
            await this.humanizer.think();

            // 5. Type the answer
            await this.humanizer.typeText(input, answer.toString());

            // 6. Submit
            await this._submit(input);

            this.stateManager.recordActivity();
            return true;

        } catch (error) {
            this.stateManager.logError(error, this.name);
            return false;
        }
    }

    /**
     * Find the answer input field.
     */
    _findInput() {
        for (const sel of this._inputSelectors) {
            try {
                const inputs = DOMHelpers.getVisibleElements(sel);
                for (const input of inputs) {
                    // Prefer inputs that are empty and editable
                    if (!input.disabled && !input.readOnly) {
                        return input;
                    }
                }
            } catch { }
        }
        return null;
    }

    /**
     * Compute the answer from question text.
     */
    _computeAnswer(questionText, input) {
        // Check if the input has a data attribute with expected answer format
        const placeholder = input.placeholder || '';

        // Try to extract math expression from question
        let answer = MathSolver.solve(questionText);

        if (answer !== null) return answer;

        // Try extracting just the mathematical part
        // Pattern: "Kolik je 5 + 3?" or "Vypočítej: 5 + 3"
        const mathPatterns = [
            /(?:kolik je|vypočítej|spočítej|výsledek|=\s*\?)\s*[:\s]*(.+?)[\?\s]*$/i,
            /(\d[\d\s+\-*/×÷().^,]+\d)\s*=?\s*\??$/,
            /(\d+\s*[+\-*/×÷]\s*\d+(?:\s*[+\-*/×÷]\s*\d+)*)/,
            /=\s*\?\s*$/
        ];

        for (const pattern of mathPatterns) {
            const match = questionText.match(pattern);
            if (match) {
                answer = MathSolver.solve(match[1] || match[0]);
                if (answer !== null) return answer;
            }
        }

        // Last resort: try the entire text as an expression
        // Remove common Czech words
        const stripped = questionText
            .replace(/kolik\s+je/gi, '')
            .replace(/vypočítej/gi, '')
            .replace(/spočítej/gi, '')
            .replace(/výsledek/gi, '')
            .replace(/doplň/gi, '')
            .replace(/\?/g, '')
            .trim();

        return MathSolver.solve(stripped);
    }

    /**
     * Submit the answer (button click or Enter key).
     */
    async _submit(input) {
        await this.humanizer.wait(200, 600);

        // Try clicking a submit button first
        for (const sel of this._submitSelectors) {
            const btn = document.querySelector(sel);
            if (btn && DOMHelpers.isVisible(btn)) {
                await this.humanizer.clickElement(btn);
                return;
            }
        }

        // Try finding button by text content
        const buttons = DOMHelpers.getVisibleElements('button');
        for (const btn of buttons) {
            const text = DOMHelpers.getTextContent(btn).toLowerCase();
            if (text.includes('ok') || text.includes('zkontrol') || text.includes('odpověd') ||
                text.includes('odeslat') || text.includes('potvrdit') || text.includes('submit')) {
                await this.humanizer.clickElement(btn);
                return;
            }
        }

        // Fallback: press Enter
        await this.humanizer.pressEnter(input);
    }

    getState() {
        return {
            ...super.getState(),
            inputFound: !!this._findInput()
        };
    }
}
