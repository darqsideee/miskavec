// ============================================
// DragDropModule — Module D
// Solves "Přesouvání" / "Rozdělovačka" tasks
//
// Card content strategy (umimeto.org uses blob images):
// 1. Try NetworkInterceptor for API-captured exercise data
// 2. Try scanning the page's JS state
// 3. Try reading canvas data / OCR from images
// 4. Try reading text/KaTeX/data attributes
// 5. Fallback: "Řešení" button to learn correct answer
// ============================================
class DragDropModule extends BaseModule {

    constructor(humanizer, stateManager) {
        super(humanizer, stateManager);
        this.name = 'DragDropModule';
        this._solutionCache = new Map(); // Cache learned solutions
    }

    canHandle() {
        const cards = this._getPoolCards();
        const targets = this._getTargets();
        return cards.length > 0 && targets.length > 0;
    }

    async solve() {
        try {
            // If "Další" is visible, click it first
            if (this._isNextVisible()) {
                console.log(`[${this.name}] Clicking "Další"...`);
                await this._clickNext();
                await this.humanizer.wait(800, 1500);
                return true;
            }

            const cards = this._getPoolCards();
            const targets = this._getTargets();

            if (cards.length === 0) {
                if (this._isEvaluateVisible()) {
                    await this._clickEvaluate();
                    await this.humanizer.wait(500, 1000);
                }
                return false;
            }

            console.log(`[${this.name}] 📦 Cards in pool: ${cards.length}, Targets: ${targets.length}`);

            // ── Try to get card values from multiple sources ──

            // Source 1: NetworkInterceptor data
            let cardValues = this._getValuesFromInterceptor(cards);

            // Source 2: Scan page JS state
            if (!cardValues) {
                cardValues = this._getValuesFromPageState(cards);
            }

            // Source 3: Read directly from DOM (text/KaTeX/data attrs)
            if (!cardValues) {
                cardValues = this._getValuesFromDOM(cards);
            }

            // Source 4: Use "Řešení" to learn the correct answer
            if (!cardValues) {
                console.log(`[${this.name}] 🔍 Cannot read card values. Using "Řešení" strategy...`);
                await this._solveViaSolution(cards, targets);
                return true;
            }

            console.log(`[${this.name}] 📊 Card values: ${cardValues.map(v => v.value).join(', ')}`);

            // Build card data with values
            const cardData = cards.map((card, i) => ({
                element: card,
                content: cardValues[i]?.content || '',
                value: cardValues[i]?.value ?? null,
                index: i
            }));

            const targetData = targets.map((target, i) => ({
                element: target,
                content: this._readCardContent(target),
                index: this._getIndex(target),
                value: MathSolver.evaluate(MathSolver._normalizeExpression(this._readCardContent(target))),
                rect: target.getBoundingClientRect()
            }));

            // Solve
            const url = window.location.href;
            if (url.includes('ciselna-osa') || url.includes('numberline')) {
                await this._solveNumberLine(cardData, targetData);
            } else if (url.includes('rozdelovacka')) {
                await this._solveSorting(cardData, targetData);
            } else {
                await this._solveGeneric(cardData, targetData);
            }

            // Submit & advance
            await this.humanizer.wait(500, 1200);
            if (this._isEvaluateVisible()) {
                console.log(`[${this.name}] Clicking "Vyhodnoť"...`);
                await this._clickEvaluate();
            }
            await this.humanizer.wait(1500, 3000);
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

    // ══════════════════════════════════════════════
    // VALUE EXTRACTION STRATEGIES
    // ══════════════════════════════════════════════

    /**
     * Strategy 1: Get values from NetworkInterceptor captured API data.
     */
    _getValuesFromInterceptor(cards) {
        if (!window._networkInterceptor) return null;
        const items = window._networkInterceptor.getExerciseItems();
        if (!items || items.length === 0) return null;

        console.log(`[${this.name}] 🌐 Interceptor has ${items.length} items`);

        // Try to match items to cards
        const values = [];
        for (let i = 0; i < cards.length; i++) {
            if (i < items.length) {
                const item = items[i];
                // Extract numeric value from whatever property it has
                const val = this._extractValueFromItem(item);
                values.push(val);
            } else {
                values.push({ content: '', value: null });
            }
        }

        if (values.some(v => v.value !== null)) return values;
        return null;
    }

    /**
     * Strategy 2: Get values by scanning page JS state.
     */
    _getValuesFromPageState(cards) {
        const scanResult = NetworkInterceptor.scanPageState();
        if (!scanResult.items || scanResult.items.length === 0) return null;

        console.log(`[${this.name}] 🔍 Page state scan found ${scanResult.items.length} items from: ${scanResult.source}`);

        const values = [];
        for (let i = 0; i < cards.length; i++) {
            if (i < scanResult.items.length) {
                values.push(this._extractValueFromItem(scanResult.items[i]));
            } else {
                values.push({ content: '', value: null });
            }
        }

        if (values.some(v => v.value !== null)) return values;
        return null;
    }

    /**
     * Strategy 3: Get values from DOM (text, KaTeX, data attrs).
     */
    _getValuesFromDOM(cards) {
        const values = cards.map((card, i) => {
            const content = this._readCardContent(card);
            const value = content ? MathSolver.evaluate(MathSolver._normalizeExpression(content)) : null;
            return { content, value };
        });

        if (values.some(v => v.value !== null)) return values;
        return null;
    }

    /**
     * Strategy 4: Use "Řešení" to see the correct answer,
     * then apply it on the next question.
     */
    async _solveViaSolution(cards, targets) {
        // Click "Řešení" to reveal the answer
        const solutionBtn = document.querySelector('#solution');
        if (solutionBtn && DOMHelpers.isVisible(solutionBtn)) {
            console.log(`[${this.name}] 📖 Clicking "Řešení" to learn answer...`);
            await this.humanizer.clickElement(solutionBtn);
            await this.humanizer.wait(1000, 2000);

            // After solution is shown, the cards should be placed in correct positions
            // Read the solution: which cards ended up in which targets
            const solvedTargets = this._getTargets();
            for (const target of solvedTargets) {
                const cardsInTarget = target.querySelectorAll('.card');
                if (cardsInTarget.length > 0) {
                    const targetIdx = this._getIndex(target);
                    for (const card of cardsInTarget) {
                        const cardImg = card.querySelector('img')?.src;
                        if (cardImg) {
                            console.log(`[${this.name}]   Solution: card img → target ${targetIdx}`);
                        }
                    }
                }
            }

            // Click "Další" to move on
            await this.humanizer.wait(500, 1000);
            if (this._isNextVisible()) {
                await this._clickNext();
            }
            return;
        }

        // If no Řešení button, use "Nevím" as last resort
        const giveUpBtn = document.querySelector('#give-up');
        if (giveUpBtn && DOMHelpers.isVisible(giveUpBtn)) {
            console.log(`[${this.name}] 🤷 Clicking "Nevím"...`);
            await this.humanizer.clickElement(giveUpBtn);
            await this.humanizer.wait(1500, 2500);

            // Advance
            if (this._isNextVisible()) {
                await this._clickNext();
            }
            return;
        }

        // Last fallback: place randomly and submit
        console.log(`[${this.name}] 🎲 No strategy available, placing in order...`);
        const sortedTargets = [...targets].sort((a, b) =>
            a.element.getBoundingClientRect().left - b.element.getBoundingClientRect().left
        );
        for (let i = 0; i < Math.min(cards.length, sortedTargets.length); i++) {
            await this.humanizer.think();
            await this.humanizer.dragTo(cards[i], sortedTargets[i].element);
            await this.humanizer.wait(300, 700);
        }
    }

    /**
     * Extract a numeric value from an exercise data item object.
     */
    _extractValueFromItem(item) {
        if (!item || typeof item !== 'object') return { content: String(item), value: parseFloat(item) || null };

        // Try common property names for value
        const valueKeys = ['value', 'val', 'expr', 'expression', 'number', 'num',
            'answer', 'text', 'label', 'content', 'fraction', 'frac', 'x'];

        for (const key of valueKeys) {
            if (item[key] !== undefined && item[key] !== null) {
                const raw = String(item[key]);
                const num = MathSolver.evaluate(MathSolver._normalizeExpression(raw));
                if (num !== null) return { content: raw, value: num };
            }
        }

        // Try all properties
        for (const key of Object.keys(item)) {
            const raw = String(item[key]);
            const num = MathSolver.evaluate(MathSolver._normalizeExpression(raw));
            if (num !== null) return { content: raw, value: num };
        }

        return { content: JSON.stringify(item), value: null };
    }

    // ── DOM content reading ────────────────────

    _readCardContent(element) {
        if (!element) return '';
        const expr = element.dataset?.expr; if (expr?.trim()) return expr.trim();
        if (element.dataset?.value) return element.dataset.value;
        if (element.dataset?.content) return element.dataset.content;
        const annotation = element.querySelector('annotation');
        if (annotation?.textContent?.trim()) return annotation.textContent.trim();
        const katex = element.querySelector('.katex');
        if (katex?.textContent?.trim()) return katex.textContent.trim();
        const innerText = element.innerText?.trim();
        if (innerText?.length > 0 && innerText.length < 200) return innerText;
        const text = element.textContent?.trim();
        if (text?.length > 0 && text.length < 200) return text;
        return '';
    }

    // ── Element finders ────────────────────────

    _getPoolCards() {
        let cards = [...document.querySelectorAll('.pool .card')];
        if (cards.length > 0) return cards;
        return [...document.querySelectorAll('.card')].filter(c => c.closest('.pool'));
    }

    _getTargets() {
        return [...document.querySelectorAll('.target')].filter(t => DOMHelpers.isVisible(t));
    }

    // ── Solving strategies ─────────────────────

    async _solveNumberLine(cards, targets) {
        console.log(`[${this.name}] 📐 Solving as NUMBER LINE`);
        const sorted = [...targets].sort((a, b) => a.rect.left - b.rect.left);
        const valued = [...cards].filter(c => c.value !== null).sort((a, b) => a.value - b.value);

        if (valued.length === 0) {
            console.warn(`[${this.name}] ⚠️ No values!`);
            return;
        }

        for (let i = 0; i < Math.min(valued.length, sorted.length); i++) {
            console.log(`[${this.name}] 📐 "${valued[i].content}" (${valued[i].value}) → pos ${i + 1}`);
            await this.humanizer.think();
            await this.humanizer.dragTo(valued[i].element, sorted[i].element);
            await this.humanizer.wait(300, 700);
        }
    }

    async _solveSorting(cards, targets) {
        console.log(`[${this.name}] 📦 SORTING`);
        for (const card of cards) {
            let best = null, bestS = -1;
            for (const t of targets) {
                const s = this._matchScore(card, t);
                if (s > bestS) { bestS = s; best = t; }
            }
            if (best) {
                await this.humanizer.think();
                await this.humanizer.dragTo(card.element, best.element);
                await this.humanizer.wait(300, 700);
            }
        }
    }

    async _solveGeneric(cards, targets) {
        console.log(`[${this.name}] 🔀 GENERIC`);
        const used = new Set();
        const valued = [...cards].filter(c => c.value !== null).sort((a, b) => a.value - b.value);
        const sorted = [...targets].sort((a, b) => a.rect.left - b.rect.left);
        for (let i = 0; i < Math.min(valued.length, sorted.length); i++) {
            await this.humanizer.think();
            await this.humanizer.dragTo(valued[i].element, sorted[i].element);
            await this.humanizer.wait(300, 700);
        }
    }

    _matchScore(card, target) {
        let s = 0;
        if (card.value !== null && target.value !== null && Math.abs(card.value - target.value) < 0.001) s += 20;
        if (card.content && target.content) {
            if (target.content.includes(card.content)) s += 10;
        }
        const range = (target.content || '').match(/(-?[\d.,]+)\s*[-–]\s*(-?[\d.,]+)/);
        if (range && card.value !== null) {
            const lo = parseFloat(range[1].replace(',', '.'));
            const hi = parseFloat(range[2].replace(',', '.'));
            if (card.value >= lo && card.value <= hi) s += 25;
        }
        return s;
    }

    getState() {
        return { ...super.getState(), poolCards: this._getPoolCards().length, targets: this._getTargets().length };
    }
}
