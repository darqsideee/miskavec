// ============================================
// ChoiceModule — Module B
// Solves "Rozhodovačka" (Choice/Decision) tasks
// umimeto.org: .card buttons with data-index
// ============================================
class ChoiceModule extends BaseModule {

    constructor(humanizer, stateManager) {
        super(humanizer, stateManager);
        this.name = 'ChoiceModule';
    }

    canHandle() {
        const buttons = this._getAnswerButtons();
        return buttons.length >= 2;
    }

    async solve() {
        try {
            // If "Další" is visible, click it
            if (this._isNextVisible()) {
                await this._clickNext();
                await this.humanizer.wait(800, 1500);
                return true;
            }

            // 1. Get question text
            const questionText = this._getQuestionText();
            console.log(`[${this.name}] 📝 Question: "${questionText}"`);

            // 2. Get all answer buttons
            const buttons = this._getAnswerButtons();
            if (buttons.length < 2) {
                console.warn(`[${this.name}] Not enough answer buttons: ${buttons.length}`);
                return false;
            }

            const options = buttons.map(b => ({
                element: b,
                text: DOMHelpers.getTextContent(b),
                expr: this._getExpr(b),
                index: this._getIndex(b),
                value: MathSolver.evaluate(MathSolver._normalizeExpression(
                    this._getExpr(b) || DOMHelpers.getTextContent(b)
                ))
            }));

            console.log(`[${this.name}] 🔘 Options: ${options.map(o => `"${o.text}" (expr=${o.expr})`).join(' | ')}`);

            // 3. Determine the correct answer
            const correct = this._findCorrectOption(questionText, options);
            if (!correct) {
                // Fallback: random pick
                const fallback = options[Math.floor(Math.random() * options.length)];
                console.log(`[${this.name}] 🎲 Random fallback: "${fallback.text}"`);
                await this.humanizer.think();
                await this.humanizer.clickElement(fallback.element);
                this.stateManager.recordActivity();
                return true;
            }

            console.log(`[${this.name}] 💡 Correct: "${correct.text}"`);

            // 4. Click with delay
            await this.humanizer.think();
            await this.humanizer.clickElement(correct.element);

            // 5. Submit if needed
            await this.humanizer.wait(300, 800);
            if (this._isEvaluateVisible()) {
                await this._clickEvaluate();
            }

            // 6. Wait and advance
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
     * Get all visible answer buttons (umimeto.org specific).
     */
    _getAnswerButtons() {
        // Primary: cards with data-index (answer options)
        let cards = DOMHelpers.getVisibleElements('.card[data-index]');
        // Exclude cards in .pool (those are for drag & drop)
        cards = cards.filter(c => !c.closest('.pool'));
        if (cards.length >= 2) return cards;

        // Fallback: buttons that look like answers
        const buttons = DOMHelpers.getVisibleElements('button.answer, .answer-option, .answers button');
        if (buttons.length >= 2) return buttons;

        // Last resort: find groups of similar clickable elements
        const allCards = DOMHelpers.getVisibleElements('.card');
        if (allCards.length >= 2) return allCards;

        return [];
    }

    /**
     * Determine which option is correct.
     */
    _findCorrectOption(questionText, options) {
        // Strategy 1: Check data-state or data-correct attributes
        for (const opt of options) {
            if (opt.element.dataset.correct === 'true' || opt.element.dataset.state === 'correct') {
                return opt;
            }
        }

        // Strategy 2: Compute expected answer and match
        const expected = MathSolver.solve(questionText);
        if (expected !== null) {
            const expectedVal = MathSolver.evaluate(MathSolver._normalizeExpression(expected));

            // Try numeric match
            if (expectedVal !== null) {
                for (const opt of options) {
                    if (opt.value !== null && Math.abs(opt.value - expectedVal) < 0.001) return opt;
                }
            }
            // Try string match
            for (const opt of options) {
                const optText = opt.text.replace(/\s/g, '');
                const expText = expected.toString().replace(/\s/g, '');
                if (optText === expText) return opt;
            }
        }

        // Strategy 3: Comparison (>, <, =)
        const comp = this._solveComparison(questionText);
        if (comp) {
            for (const opt of options) {
                if (opt.text.trim() === comp) return opt;
            }
        }

        // Strategy 4: True/False
        const tf = this._solveTrueFalse(questionText);
        if (tf !== null) {
            for (const opt of options) {
                const t = opt.text.toLowerCase();
                if (tf && (t === 'ano' || t === 'true' || t === 'pravda' || t === 'správně' || t === '✓')) return opt;
                if (!tf && (t === 'ne' || t === 'false' || t === 'nepravda' || t === 'špatně' || t === '✗')) return opt;
            }
        }

        // Strategy 5: Evaluate the question as an expression and match to button values
        const qValue = MathSolver.evaluate(MathSolver._normalizeExpression(questionText));
        if (qValue !== null) {
            for (const opt of options) {
                if (opt.value !== null && Math.abs(opt.value - qValue) < 0.001) return opt;
            }
        }

        // Strategy 6: For each option, check if its expression evaluates to the question
        for (const opt of options) {
            if (opt.expr) {
                const optResult = MathSolver.solve(opt.expr);
                if (optResult !== null && expected !== null && optResult === expected) return opt;
            }
        }

        return null;
    }

    _solveComparison(text) {
        const match = text.match(/(-?[\d.,]+)\s*[?☐□_]\s*(-?[\d.,]+)/);
        if (match) {
            const a = parseFloat(match[1].replace(',', '.'));
            const b = parseFloat(match[2].replace(',', '.'));
            if (a > b) return '>';
            if (a < b) return '<';
            return '=';
        }
        return null;
    }

    _solveTrueFalse(text) {
        const match = text.match(/(.+?)\s*=\s*(.+)/);
        if (match) {
            const left = MathSolver.evaluate(MathSolver._normalizeExpression(match[1]));
            const right = MathSolver.evaluate(MathSolver._normalizeExpression(match[2]));
            if (left !== null && right !== null) {
                return Math.abs(left - right) < 0.001;
            }
        }
        return null;
    }

    getState() {
        return { ...super.getState(), buttonCount: this._getAnswerButtons().length };
    }
}
