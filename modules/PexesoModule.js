// ============================================
// PexesoModule — Module C
// Solves "Pexeso" (Memory/Matching) games
// umimeto.org: .card elements with data-expr
// ============================================
class PexesoModule extends BaseModule {

    constructor(humanizer, stateManager) {
        super(humanizer, stateManager);
        this.name = 'PexesoModule';
        this._cardMemory = new Map(); // id → content
        this._matchedPairs = new Set();
    }

    canHandle() {
        const cards = this._getCards();
        return cards.length >= 4;
    }

    async solve() {
        try {
            const cards = this._getCards();
            if (cards.length < 4) {
                // Game might be over
                if (this._isNextVisible()) {
                    await this._clickNext();
                    await this.humanizer.wait(800, 1500);
                    this.reset();
                }
                return cards.length > 0;
            }

            // Get unmatched cards
            const available = this._getUnmatchedCards(cards);
            if (available.length < 2) {
                console.log(`[${this.name}] ✅ All cards matched!`);
                if (this._isNextVisible()) {
                    await this._clickNext();
                    this.reset();
                }
                return true;
            }

            // Known pair?
            const pair = this._findKnownPair(available);
            if (pair) {
                console.log(`[${this.name}] 🎯 Known pair!`);
                await this._clickPair(pair[0], pair[1]);
                return true;
            }

            // Explore two unknown cards
            const unknowns = available.filter(c => !this._cardMemory.has(this._cardId(c)));
            if (unknowns.length >= 2) {
                await this._explore(unknowns[0], unknowns[1]);
            } else if (unknowns.length === 1) {
                const known = available.find(c => this._cardMemory.has(this._cardId(c)) && c !== unknowns[0]);
                if (known) await this._explore(unknowns[0], known);
            } else if (available.length >= 2) {
                await this._explore(available[0], available[1]);
            }

            this.stateManager.recordActivity();
            return true;

        } catch (error) {
            this.stateManager.logError(error, this.name);
            return false;
        }
    }

    _getCards() {
        // Try umimeto pexeso selectors
        let cards = DOMHelpers.getVisibleElements('.card[data-index]');
        if (cards.length >= 4) return cards;

        cards = DOMHelpers.getVisibleElements('.card');
        if (cards.length >= 4) return cards;

        return [];
    }

    _getUnmatchedCards(cards) {
        return cards.filter(card => {
            const id = this._cardId(card);
            if (this._matchedPairs.has(id)) return false;
            if (card.classList.contains('matched') || card.classList.contains('found') ||
                card.classList.contains('done') || card.classList.contains('solved')) {
                this._matchedPairs.add(id);
                return false;
            }
            const style = window.getComputedStyle(card);
            if (style.opacity === '0' || style.visibility === 'hidden') {
                this._matchedPairs.add(id);
                return false;
            }
            return true;
        });
    }

    _cardId(card) {
        return card.id || card.dataset.index || card.dataset.card ||
            [...card.parentElement.children].indexOf(card).toString();
    }

    _readContent(card) {
        // data-expr first
        if (card.dataset.expr) return card.dataset.expr;

        // Visual text
        const textEl = card.querySelector('.card-front, .card-face, .text, span, p');
        if (textEl) {
            const t = DOMHelpers.getTextContent(textEl);
            if (t) return t;
        }
        if (card.dataset.value) return card.dataset.value;
        return DOMHelpers.getTextContent(card);
    }

    _findKnownPair(cards) {
        const entries = [];
        for (const card of cards) {
            const content = this._cardMemory.get(this._cardId(card));
            if (content) entries.push({ card, content });
        }
        for (let i = 0; i < entries.length; i++) {
            for (let j = i + 1; j < entries.length; j++) {
                if (MathSolver.areEquivalent(entries[i].content, entries[j].content)) {
                    return [entries[i].card, entries[j].card];
                }
            }
        }
        return null;
    }

    async _explore(card1, card2) {
        await this.humanizer.think();
        await this.humanizer.clickElement(card1);
        await this.humanizer.wait(400, 800);

        const c1 = this._readContent(card1);
        this._cardMemory.set(this._cardId(card1), c1);
        console.log(`[${this.name}] Card: "${c1}"`);

        await this.humanizer.wait(300, 700);
        await this.humanizer.clickElement(card2);
        await this.humanizer.wait(400, 800);

        const c2 = this._readContent(card2);
        this._cardMemory.set(this._cardId(card2), c2);
        console.log(`[${this.name}] Card: "${c2}"`);

        if (MathSolver.areEquivalent(c1, c2)) {
            console.log(`[${this.name}] 🎉 Match!`);
            this._matchedPairs.add(this._cardId(card1));
            this._matchedPairs.add(this._cardId(card2));
            this.stateManager.recordCorrect();
        }
        await this.humanizer.wait(800, 1500);
    }

    async _clickPair(card1, card2) {
        await this.humanizer.think();
        await this.humanizer.clickElement(card1);
        await this.humanizer.wait(300, 600);
        await this.humanizer.clickElement(card2);
        this._matchedPairs.add(this._cardId(card1));
        this._matchedPairs.add(this._cardId(card2));
        this.stateManager.recordCorrect();
        await this.humanizer.wait(500, 1000);
    }

    reset() {
        this._cardMemory.clear();
        this._matchedPairs.clear();
        console.log(`[${this.name}] 🔄 Memory cleared`);
    }

    getState() {
        return {
            ...super.getState(),
            knownCards: this._cardMemory.size,
            matchedPairs: this._matchedPairs.size / 2
        };
    }
}
