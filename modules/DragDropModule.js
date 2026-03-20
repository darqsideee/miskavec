// ============================================
// DragDropModule — Module D
// Solves "Přesouvání" / "Rozdělovačka" tasks
// Real umimeto.org selectors: .pool .card,
// .target, data-expr, #evaluate, #next
//
// Card content: read via KaTeX, innerText,
// innerHTML, nested spans, images, data attrs.
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

            // Read card data with robust content extraction
            const cardData = cards.map((card, i) => {
                const content = this._readCardContent(card);
                const value = MathSolver.evaluate(MathSolver._normalizeExpression(content));
                console.log(`[${this.name}]   Card[${i}]: content="${content}" value=${value} innerHTML=${card.innerHTML.substring(0, 80)}`);
                return { element: card, content, value, index: i };
            });

            // Read target data
            const targetData = targets.map((target, i) => {
                const content = this._readCardContent(target);
                const index = this._getIndex(target);
                const value = MathSolver.evaluate(MathSolver._normalizeExpression(content));
                const rect = target.getBoundingClientRect();
                console.log(`[${this.name}]   Target[${i}]: content="${content}" index="${index}" value=${value} left=${Math.round(rect.left)}`);
                return { element: target, content, index, value, rect };
            });

            // Determine task type and solve
            const url = window.location.href;

            if (url.includes('ciselna-osa') || url.includes('numberline')) {
                await this._solveNumberLine(cardData, targetData);
            } else if (url.includes('rozdelovacka')) {
                await this._solveSorting(cardData, targetData);
            } else {
                await this._solveGeneric(cardData, targetData);
            }

            // After placing, click "Vyhodnoť"
            await this.humanizer.wait(500, 1200);
            if (this._isEvaluateVisible()) {
                console.log(`[${this.name}] Clicking "Vyhodnoť"...`);
                await this._clickEvaluate();
                this.stateManager.recordActivity();
            }

            // Wait for results, then hit "Další"
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

    // ── Robust content reading ─────────────────

    /**
     * Read the content/value from a card or target element.
     * Tries multiple strategies for KaTeX, images, nested elements.
     */
    _readCardContent(element) {
        if (!element) return '';

        // Strategy 1: data-expr attribute
        const expr = element.dataset?.expr || element.getAttribute('data-expr');
        if (expr && expr.trim()) return expr.trim();

        // Strategy 2: data-value, data-content
        if (element.dataset?.value) return element.dataset.value;
        if (element.dataset?.content) return element.dataset.content;

        // Strategy 3: KaTeX rendered math — extract from annotation
        // KaTeX puts the original LaTeX in <annotation encoding="application/x-tex">
        const annotation = element.querySelector('annotation');
        if (annotation) {
            const tex = annotation.textContent.trim();
            if (tex) return tex;
        }

        // Strategy 4: KaTeX — read from .katex-mathml semantics
        const mathml = element.querySelector('.katex-mathml');
        if (mathml) {
            const tex = mathml.textContent.trim();
            if (tex) {
                // KaTeX mathml textContent often has the expression duplicated
                // Take just the first half if it's doubled
                if (tex.length > 2 && tex.length % 2 === 0) {
                    const half = tex.substring(0, tex.length / 2);
                    if (tex === half + half) return half;
                }
                return tex;
            }
        }

        // Strategy 5: KaTeX — read visible text from .katex-html
        const katexHtml = element.querySelector('.katex-html');
        if (katexHtml) {
            const text = katexHtml.textContent.trim();
            if (text) return text;
        }

        // Strategy 6: Any .katex element
        const katex = element.querySelector('.katex');
        if (katex) {
            const text = katex.textContent.trim();
            if (text) return text;
        }

        // Strategy 7: innerText (preserves visual layout better)
        const innerText = element.innerText?.trim();
        if (innerText && innerText.length > 0 && innerText.length < 200) return innerText;

        // Strategy 8: textContent
        const text = element.textContent?.trim();
        if (text && text.length > 0 && text.length < 200) return text;

        // Strategy 9: img alt text
        const img = element.querySelector('img');
        if (img) return img.alt || img.title || '';

        // Strategy 10: SVG text
        const svgText = element.querySelector('svg text');
        if (svgText) return svgText.textContent.trim();

        return '';
    }

    // ── Element finders ────────────────────────

    _getPoolCards() {
        let cards = [...document.querySelectorAll('.pool .card')];
        if (cards.length > 0) return cards;

        // Fallback: cards not in a target
        cards = [...document.querySelectorAll('.card')].filter(c => {
            return !c.closest('.target') && c.closest('.pool');
        });
        return cards;
    }

    _getTargets() {
        return [...document.querySelectorAll('.target')].filter(t => DOMHelpers.isVisible(t));
    }

    // ── Number line solving ──────────────────

    async _solveNumberLine(cards, targets) {
        console.log(`[${this.name}] 📐 Solving as NUMBER LINE`);

        // Sort targets left-to-right by screen position
        const sortedTargets = [...targets].sort((a, b) => a.rect.left - b.rect.left);

        // Sort cards by their numeric value (ascending = left-to-right on number line)
        const sortedCards = [...cards].filter(c => c.value !== null).sort((a, b) => a.value - b.value);

        // If we can't evaluate cards, we can't solve correctly
        if (sortedCards.length === 0) {
            console.warn(`[${this.name}] ⚠️ No card values could be computed! Trying index-based ordering.`);
            // Try index-based or just sequential
            for (let i = 0; i < Math.min(cards.length, sortedTargets.length); i++) {
                await this.humanizer.think();
                await this.humanizer.dragTo(cards[i].element, sortedTargets[i].element);
                await this.humanizer.wait(300, 700);
            }
            return;
        }

        // If targets have values, match to closest
        const targetsHaveValues = sortedTargets.some(t => t.value !== null);

        if (targetsHaveValues) {
            const usedTargets = new Set();
            for (const card of sortedCards) {
                let bestIdx = -1;
                let bestDiff = Infinity;
                for (let i = 0; i < sortedTargets.length; i++) {
                    if (usedTargets.has(i) || sortedTargets[i].value === null) continue;
                    const diff = Math.abs(card.value - sortedTargets[i].value);
                    if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
                }
                if (bestIdx >= 0) {
                    console.log(`[${this.name}] 🎯 "${card.content}" (${card.value}) → target ${bestIdx} (${sortedTargets[bestIdx].value})`);
                    await this.humanizer.think();
                    await this.humanizer.dragTo(card.element, sortedTargets[bestIdx].element);
                    usedTargets.add(bestIdx);
                    await this.humanizer.wait(300, 700);
                }
            }
        } else {
            // No target values — place sorted cards left to right
            for (let i = 0; i < Math.min(sortedCards.length, sortedTargets.length); i++) {
                console.log(`[${this.name}] 📐 "${sortedCards[i].content}" (${sortedCards[i].value}) → position ${i + 1}`);
                await this.humanizer.think();
                await this.humanizer.dragTo(sortedCards[i].element, sortedTargets[i].element);
                await this.humanizer.wait(300, 700);
            }
        }

        // Handle remaining cards if more cards than targets
        const remainingCards = cards.filter(c => c.value === null);
        if (remainingCards.length > 0 && sortedTargets.length > sortedCards.length) {
            for (let i = 0; i < remainingCards.length; i++) {
                const tgtIdx = sortedCards.length + i;
                if (tgtIdx < sortedTargets.length) {
                    console.log(`[${this.name}] 📐 Placing unknown card at position ${tgtIdx + 1}`);
                    await this.humanizer.think();
                    await this.humanizer.dragTo(remainingCards[i].element, sortedTargets[tgtIdx].element);
                    await this.humanizer.wait(300, 700);
                }
            }
        }
    }

    // ── Sorting solving ──────────────────────

    async _solveSorting(cards, targets) {
        console.log(`[${this.name}] 📦 Solving as SORTING`);
        for (const card of cards) {
            let best = null, bestScore = -1;
            for (const target of targets) {
                const score = this._matchScore(card, target);
                if (score > bestScore) { bestScore = score; best = target; }
            }
            if (best) {
                console.log(`[${this.name}] 🎯 "${card.content}" → "${best.content}"`);
                await this.humanizer.think();
                await this.humanizer.dragTo(card.element, best.element);
                await this.humanizer.wait(300, 700);
            }
        }
    }

    // ── Generic solving ──────────────────────

    async _solveGeneric(cards, targets) {
        console.log(`[${this.name}] 🔀 Solving GENERIC`);
        // Try value matching
        const usedTargets = new Set();
        for (const card of cards) {
            if (card.value === null) continue;
            for (let i = 0; i < targets.length; i++) {
                if (usedTargets.has(i)) continue;
                if (targets[i].value !== null && Math.abs(card.value - targets[i].value) < 0.001) {
                    console.log(`[${this.name}] 🔗 "${card.content}" ↔ "${targets[i].content}"`);
                    await this.humanizer.think();
                    await this.humanizer.dragTo(card.element, targets[i].element);
                    usedTargets.add(i);
                    await this.humanizer.wait(300, 700);
                    break;
                }
            }
        }
        // Place remaining sorted by value
        const sorted = [...cards].filter(c => c.value !== null).sort((a, b) => a.value - b.value);
        for (let i = 0; i < sorted.length; i++) {
            if (usedTargets.has(i)) continue;
            if (i < targets.length) {
                await this.humanizer.think();
                await this.humanizer.dragTo(sorted[i].element, targets[i].element);
                usedTargets.add(i);
                await this.humanizer.wait(300, 700);
            }
        }
    }

    _matchScore(card, target) {
        let score = 0;
        if (card.value !== null && target.value !== null && Math.abs(card.value - target.value) < 0.001) score += 20;
        if (card.content && target.content) {
            if (target.content.includes(card.content)) score += 10;
            if (card.content.includes(target.content)) score += 10;
        }
        const range = target.content.match(/(-?[\d.,]+)\s*[-–]\s*(-?[\d.,]+)/);
        if (range && card.value !== null) {
            const lo = parseFloat(range[1].replace(',', '.'));
            const hi = parseFloat(range[2].replace(',', '.'));
            if (card.value >= lo && card.value <= hi) score += 25;
        }
        return score;
    }

    getState() {
        return { ...super.getState(), poolCards: this._getPoolCards().length, targets: this._getTargets().length };
    }
}
