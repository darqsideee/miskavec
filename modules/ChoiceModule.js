// ============================================
// ChoiceModule — Module B
// Solves "Rozhodovačka" (Choice/Decision) tasks
// Identifies correct answer among buttons.
// ============================================
class ChoiceModule extends BaseModule {

    constructor(humanizer, stateManager) {
        super(humanizer, stateManager);
        this.name = 'ChoiceModule';
        this._answerSelectors = [
            '.board button.answer',
            '.board .answer-button',
            'button[class*="answer"]',
            '.answers button',
            '.options button',
            '.choices button',
            '.alternatives button',
            '[class*="answer-btn"]',
            '.answer-option',
            'button[data-answer]',
            '.board button',
            'button[class*="option"]'
        ];
    }

    canHandle() {
        const buttons = this._getAnswerButtons();
        return buttons.length >= 2; // Need at least 2 options
    }

    async solve() {
        try {
            // 1. Get question text
            const questionText = this._getQuestionText();
            console.log(`[${this.name}] 📝 Question: "${questionText}"`);

            // 2. Get all answer buttons
            const buttons = this._getAnswerButtons();
            if (buttons.length < 2) {
                console.warn(`[${this.name}] Not enough answer buttons found: ${buttons.length}`);
                return false;
            }

            console.log(`[${this.name}] 🔘 Options: ${buttons.map(b => DOMHelpers.getTextContent(b)).join(' | ')}`);

            // 3. Determine the correct answer
            const correctButton = this._findCorrectButton(questionText, buttons);
            if (!correctButton) {
                console.warn(`[${this.name}] Could not determine correct answer`);
                // Fallback: pick a random one (better than nothing)
                const fallback = buttons[Math.floor(Math.random() * buttons.length)];
                console.log(`[${this.name}] 🎲 Falling back to random: "${DOMHelpers.getTextContent(fallback)}"`);
                await this.humanizer.think();
                await this.humanizer.clickElement(fallback);
                this.stateManager.recordActivity();
                return true;
            }

            console.log(`[${this.name}] 💡 Correct: "${DOMHelpers.getTextContent(correctButton)}"`);

            // 4. Human-like delay
            await this.humanizer.think();

            // 5. Click the correct button
            await this.humanizer.clickElement(correctButton);

            this.stateManager.recordActivity();
            return true;

        } catch (error) {
            this.stateManager.logError(error, this.name);
            return false;
        }
    }

    /**
     * Get all visible answer buttons.
     */
    _getAnswerButtons() {
        for (const sel of this._answerSelectors) {
            try {
                const buttons = DOMHelpers.getVisibleElements(sel);
                if (buttons.length >= 2) return buttons;
            } catch { }
        }

        // Fallback: find groups of similar buttons
        const allButtons = DOMHelpers.getVisibleElements('button');
        // Filter to buttons with short text content (answer-like)
        const candidates = allButtons.filter(b => {
            const text = DOMHelpers.getTextContent(b);
            return text.length > 0 && text.length < 100;
        });
        // Only return if we have at least 2
        return candidates.length >= 2 ? candidates : [];
    }

    /**
     * Determine which button is the correct answer.
     */
    _findCorrectButton(questionText, buttons) {
        const buttonTexts = buttons.map(b => ({
            element: b,
            text: DOMHelpers.getTextContent(b),
            value: MathSolver.evaluate(MathSolver._normalizeExpression(DOMHelpers.getTextContent(b)))
        }));

        // Strategy 1: Check if any button has "correct" indicators
        for (const btn of buttonTexts) {
            if (btn.element.dataset.correct === 'true' || btn.element.dataset.answer === 'true') {
                return btn.element;
            }
        }

        // Strategy 2: For math questions — compute what the answer should be
        const expectedAnswer = MathSolver.solve(questionText);
        if (expectedAnswer !== null) {
            const expectedVal = MathSolver.evaluate(MathSolver._normalizeExpression(expectedAnswer));
            if (expectedVal !== null) {
                for (const btn of buttonTexts) {
                    if (btn.value !== null && Math.abs(btn.value - expectedVal) < 0.001) {
                        return btn.element;
                    }
                }
            }
            // Also try string matching
            for (const btn of buttonTexts) {
                if (btn.text.trim() === expectedAnswer.toString().trim()) {
                    return btn.element;
                }
            }
        }

        // Strategy 3: For comparison questions (>, <, =)
        const compResult = this._solveComparison(questionText);
        if (compResult) {
            for (const btn of buttonTexts) {
                if (btn.text.trim() === compResult) {
                    return btn.element;
                }
            }
        }

        // Strategy 4: For true/false questions
        const trueFalseResult = this._solveTrueFalse(questionText);
        if (trueFalseResult !== null) {
            for (const btn of buttonTexts) {
                const text = btn.text.toLowerCase();
                if (trueFalseResult && (text === 'ano' || text === 'true' || text === 'pravda' || text === 'správně' || text === '✓')) {
                    return btn.element;
                }
                if (!trueFalseResult && (text === 'ne' || text === 'false' || text === 'nepravda' || text === 'špatně' || text === '✗')) {
                    return btn.element;
                }
            }
        }

        // Strategy 5: For "which is correct" — evaluate each option
        for (const btn of buttonTexts) {
            const checkResult = MathSolver.solve(btn.text);
            if (checkResult !== null && questionText.includes(checkResult)) {
                return btn.element;
            }
        }

        // Strategy 6: For questions asking to evaluate expressions in buttons
        // E.g., question "5 × 3" and buttons show "15", "12", "18", "20"
        const questionValue = MathSolver.evaluate(MathSolver._normalizeExpression(questionText));
        if (questionValue !== null) {
            for (const btn of buttonTexts) {
                if (btn.value !== null && Math.abs(btn.value - questionValue) < 0.001) {
                    return btn.element;
                }
            }
        }

        return null;
    }

    /**
     * Solve comparison: "15 ? 12" → ">"
     */
    _solveComparison(text) {
        // Pattern: "A ? B" or "A ☐ B"
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

    /**
     * Solve true/false: "5 + 3 = 9" → false
     */
    _solveTrueFalse(text) {
        // Pattern: "A = B" — check if the equation is correct
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
        return {
            ...super.getState(),
            buttonCount: this._getAnswerButtons().length
        };
    }
}
