// ============================================
// DragDropModule — Module D
// Solves "Přesouvání" / "Rozdělovačka" tasks
// Real umimeto.org selectors: .pool .card,
// .target, data-expr, #evaluate, #next
// ============================================
class DragDropModule extends BaseModule {

    constructor(humanizer, stateManager) {
        super(humanizer, stateManager);
        this.name = 'DragDropModule';
    }

    canHandle() {
        const cards = this._getPoolCards();
        const targets = this._getTargets();
        const hasPool = !!document.querySelector('.pool');
        console.log(`[${this.name}] canHandle check: ${cards.length} cards, ${targets.length} targets, pool: ${hasPool}`);
        return cards.length > 0 && targets.length > 0;
    }

    async solve() {
        try {
            // If "Další" is visible, click it first (previous question results shown)
            if (this._isNextVisible()) {
                console.log(`[${this.name}] Clicking "Další"...`);
                await this._clickNext();
                await this.humanizer.wait(800, 1500);
                return true;
            }

            const cards = this._getPoolCards();
            const targets = this._getTargets();

            if (cards.length === 0) {
                console.log(`[${this.name}] No cards in pool (maybe already placed or between questions)`);
                // Maybe evaluate button is waiting
                if (this._isEvaluateVisible()) {
                    await this._clickEvaluate();
                    await this.humanizer.wait(500, 1000);
                }
                return false;
            }

            console.log(`[${this.name}] 📦 Cards in pool: ${cards.length}, Targets: ${targets.length}`);

            // Read card data
            const cardData = cards.map(card => {
                const expr = this._getExpr(card);
                const text = DOMHelpers.getTextContent(card);
                const value = MathSolver.evaluate(MathSolver._normalizeExpression(expr || text));
                console.log(`[${this.name}]   Card: expr="${expr}" text="${text}" value=${value}`);
                return { element: card, expr, text, value };
            });

            // Read target data
            const targetData = targets.map(target => {
                const expr = this._getExpr(target);
                const text = DOMHelpers.getTextContent(target);
                const index = this._getIndex(target);
                const value = MathSolver.evaluate(MathSolver._normalizeExpression(expr || text));
                console.log(`[${this.name}]   Target: expr="${expr}" text="${text}" index="${index}" value=${value}`);
                return { element: target, expr, text, index, value };
            });

            // Determine matching strategy
            const url = window.location.href;

            if (url.includes('ciselna-osa') || url.includes('numberline')) {
                // Number line: sort cards by value and place in order
                await this._solveNumberLine(cardData, targetData);
            } else if (url.includes('rozdelovacka')) {
                // Sorting into categories
                await this._solveSorting(cardData, targetData);
            } else {
                // Generic: try value matching, then positional
                await this._solveGeneric(cardData, targetData);
            }

            // After placing cards, click "Vyhodnoť"
            await this.humanizer.wait(500, 1200);
            if (this._isEvaluateVisible()) {
                console.log(`[${this.name}] Clicking "Vyhodnoť"...`);
                await this._clickEvaluate();
                this.stateManager.recordActivity();
            }

            // Wait for result, then click "Další"
            await this.humanizer.wait(1000, 2500);
            if (this._isNextVisible()) {
                await this.humanizer.wait(500, 1000);
                await this._clickNext();
            }

            this.stateManager.recordActivity();
            return true;

        } catch (error) {
            this.stateManager.logError(error, this.name);
            return false;
        }
    }

    // ── Element finders (umimeto-specific) ───────

    _getPoolCards() {
        // Cards that are still in the pool (not yet placed)
        const poolCards = [...document.querySelectorAll('.pool .card')];
        if (poolCards.length > 0) return poolCards;

        // Fallback: cards with data-expr that haven't been placed
        const exprCards = [...document.querySelectorAll('.card[data-expr]')];
        return exprCards.filter(c => {
            const parent = c.parentElement;
            return parent && (parent.classList.contains('pool') || !parent.classList.contains('target'));
        });
    }

    _getTargets() {
        return [...document.querySelectorAll('.target')].filter(t => DOMHelpers.isVisible(t));
    }

    // ── Number line solving ──────────────────────

    async _solveNumberLine(cards, targets) {
        console.log(`[${this.name}] 📐 Solving as NUMBER LINE`);

        // Sort targets by their position (left to right)
        targets.sort((a, b) => {
            const rectA = a.element.getBoundingClientRect();
            const rectB = b.element.getBoundingClientRect();
            return rectA.left - rectB.left;
        });

        // Sort cards by their numeric value
        const sortedCards = [...cards].sort((a, b) => {
            if (a.value !== null && b.value !== null) return a.value - b.value;
            return 0;
        });

        // If targets have values, match cards to closest target
        const targetsHaveValues = targets.some(t => t.value !== null);

        if (targetsHaveValues) {
            // Match each card to the target with the closest value
            const usedTargets = new Set();
            for (const card of sortedCards) {
                if (card.value === null) continue;

                let bestTarget = null;
                let bestDiff = Infinity;
                for (let i = 0; i < targets.length; i++) {
                    if (usedTargets.has(i)) continue;
                    if (targets[i].value === null) continue;
                    const diff = Math.abs(card.value - targets[i].value);
                    if (diff < bestDiff) {
                        bestDiff = diff;
                        bestTarget = i;
                    }
                }

                if (bestTarget !== null) {
                    console.log(`[${this.name}] 🎯 Dragging "${card.expr}" (${card.value}) → target value ${targets[bestTarget].value}`);
                    await this.humanizer.think();
                    await this.humanizer.dragTo(card.element, targets[bestTarget].element);
                    usedTargets.add(bestTarget);
                    await this.humanizer.wait(300, 700);
                }
            }
        } else {
            // Targets have no values, place sorted cards left to right
            for (let i = 0; i < Math.min(sortedCards.length, targets.length); i++) {
                console.log(`[${this.name}] 📐 Placing "${sortedCards[i].expr}" at position ${i + 1}`);
                await this.humanizer.think();
                await this.humanizer.dragTo(sortedCards[i].element, targets[i].element);
                await this.humanizer.wait(300, 700);
            }
        }
    }

    // ── Sorting solving ──────────────────────────

    async _solveSorting(cards, targets) {
        console.log(`[${this.name}] 📦 Solving as SORTING`);

        for (const card of cards) {
            let bestTarget = null;
            let bestScore = -1;

            for (const target of targets) {
                const score = this._matchScore(card, target);
                if (score > bestScore) {
                    bestScore = score;
                    bestTarget = target;
                }
            }

            if (bestTarget) {
                console.log(`[${this.name}] 🎯 Sorting "${card.text}" → "${bestTarget.text}"`);
                await this.humanizer.think();
                await this.humanizer.dragTo(card.element, bestTarget.element);
                await this.humanizer.wait(300, 700);
            }
        }
    }

    // ── Generic solving ──────────────────────────

    async _solveGeneric(cards, targets) {
        console.log(`[${this.name}] 🔀 Solving GENERIC`);

        // Try value matching first
        const usedTargets = new Set();
        let matched = false;

        for (const card of cards) {
            if (card.value === null) continue;
            for (let i = 0; i < targets.length; i++) {
                if (usedTargets.has(i)) continue;
                if (targets[i].value !== null && Math.abs(card.value - targets[i].value) < 0.001) {
                    console.log(`[${this.name}] 🔗 Match: "${card.text}" ↔ "${targets[i].text}"`);
                    await this.humanizer.think();
                    await this.humanizer.dragTo(card.element, targets[i].element);
                    usedTargets.add(i);
                    matched = true;
                    await this.humanizer.wait(300, 700);
                    break;
                }
            }
        }

        // If no value matches, try positional: sort by value and place in order
        if (!matched) {
            const sorted = [...cards].sort((a, b) => {
                if (a.value !== null && b.value !== null) return a.value - b.value;
                return 0;
            });
            for (let i = 0; i < Math.min(sorted.length, targets.length); i++) {
                if (usedTargets.has(i)) continue;
                console.log(`[${this.name}] 📦 Placing "${sorted[i].text}" → target ${i + 1}`);
                await this.humanizer.think();
                await this.humanizer.dragTo(sorted[i].element, targets[i].element);
                usedTargets.add(i);
                await this.humanizer.wait(300, 700);
            }
        }
    }

    /**
     * Score how well a card matches a target.
     */
    _matchScore(card, target) {
        let score = 0;
        if (card.value !== null && target.value !== null) {
            if (Math.abs(card.value - target.value) < 0.001) score += 20;
        }
        if (card.text && target.text) {
            if (target.text.toLowerCase().includes(card.text.toLowerCase())) score += 10;
            if (card.text.toLowerCase().includes(target.text.toLowerCase())) score += 10;
        }
        // Range-based targets: "0-10", "11-20"
        const range = target.text.match(/(-?[\d.,]+)\s*[-–]\s*(-?[\d.,]+)/);
        if (range && card.value !== null) {
            const lo = parseFloat(range[1].replace(',', '.'));
            const hi = parseFloat(range[2].replace(',', '.'));
            if (card.value >= lo && card.value <= hi) score += 25;
        }
        return score;
    }

    getState() {
        return {
            ...super.getState(),
            poolCards: this._getPoolCards().length,
            targets: this._getTargets().length
        };
    }
}
