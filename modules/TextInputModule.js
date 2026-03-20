// ============================================
// TextInputModule — Module A
// Solves "Psaná odpověď" (Written Answer) tasks
// umimeto.org: input fields + #evaluate button
// ============================================
class TextInputModule extends BaseModule {

    constructor(humanizer, stateManager) {
        super(humanizer, stateManager);
        this.name = 'TextInputModule';
    }

    canHandle() {
        const input = this._findInput();
        return !!input;
    }

    async solve() {
        try {
            // If "Další" is visible, click it (between questions)
            if (this._isNextVisible()) {
                await this._clickNext();
                await this.humanizer.wait(800, 1500);
                return true;
            }

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

            // 6. Submit via #evaluate button
            await this.humanizer.wait(300, 800);
            if (this._isEvaluateVisible()) {
                await this._clickEvaluate();
            } else {
                await this.humanizer.pressEnter(input);
            }

            // 7. Wait and click "Další" if shown
            await this.humanizer.wait(1000, 2500);
            if (this._isNextVisible()) {
                await this.humanizer.wait(400, 800);
                await this._clickNext();
            }

            this.stateManager.recordActivity();
            return true;

        } catch (error) {
            this.stateManager.logError(error, this.name);
            return false;
        }
    }

    /**
     * Find the answer input field (umimeto-specific).
     */
    _findInput() {
        const selectors = [
            '#answer-input',
            'input.answer',
            'input[name="answer"]',
            'input[data-answer]'
        ];

        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el && DOMHelpers.isVisible(el) && !el.disabled && !el.readOnly) {
                return el;
            }
        }

        // Fallback: any visible text/number input not in header
        const allInputs = DOMHelpers.getVisibleElements('input[type="text"], input[type="number"], input:not([type])');
        for (const input of allInputs) {
            if (input.classList.contains('search-input')) continue;
            if (input.id === 'header-search-input') continue;
            if (input.id === 'page-search-input-mobile') continue;
            if (input.type === 'hidden' || input.type === 'file' || input.type === 'email') continue;
            if (!input.disabled && !input.readOnly) return input;
        }
        return null;
    }

    /**
     * Compute the answer from question text.
     */
    _computeAnswer(questionText, input) {
        // Check placeholder for hints
        const placeholder = input.placeholder || '';

        // Try to solve directly
        let answer = MathSolver.solve(questionText);
        if (answer !== null) return answer;

        // Try extracting just the math expression
        const mathPatterns = [
            /(?:kolik je|vypočítej|spočítej|výsledek|doplň|=\s*\?)\s*[:\s]*(.+?)[\?\s]*$/i,
            /(\d[\d\s+\-*/×÷().^,]+\d)\s*=?\s*\??$/,
            /(\d+\s*[+\-*/×÷]\s*\d+(?:\s*[+\-*/×÷]\s*\d+)*)/,
        ];

        for (const pattern of mathPatterns) {
            const match = questionText.match(pattern);
            if (match) {
                answer = MathSolver.solve(match[1] || match[0]);
                if (answer !== null) return answer;
            }
        }

        // Strip Czech words and retry
        const stripped = questionText
            .replace(/kolik\s+je/gi, '').replace(/vypočítej/gi, '')
            .replace(/spočítej/gi, '').replace(/výsledek/gi, '')
            .replace(/doplň/gi, '').replace(/\?/g, '').trim();

        return MathSolver.solve(stripped);
    }

    getState() {
        return { ...super.getState(), inputFound: !!this._findInput() };
    }
}
