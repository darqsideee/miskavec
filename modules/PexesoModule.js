// ============================================
// PexesoModule — Module C
// Solves "Pexeso" (Memory/Matching) games
// Maintains a card memory map, pairs matches.
// ============================================
class PexesoModule extends BaseModule {

    constructor(humanizer, stateManager) {
        super(humanizer, stateManager);
        this.name = 'PexesoModule';
        this._cardMemory = new Map(); // id/index → card content
        this._matchedPairs = new Set(); // Set of matched card ids
        this._cardSelectors = [
            '.pexeso-card', '.card[class*="pexeso"]',
            '.memory-card', '[class*="pexeso"]',
            '.card-grid .card', '.game-card',
            '[data-card]', '.board .card'
        ];
        this._flippedClass = ['flipped', 'turned', 'active', 'revealed', 'open', 'show'];
        this._matchedClass = ['matched', 'found', 'paired', 'done', 'correct', 'solved'];
    }

    canHandle() {
        const cards = this._getCards();
        return cards.length >= 4; // Minimum for a pexeso game
    }

    async solve() {
        try {
            const cards = this._getCards();
            if (cards.length < 4) {
                console.warn(`[${this.name}] Not enough cards: ${cards.length}`);
                return false;
            }

            console.log(`[${this.name}] 🃏 Found ${cards.length} cards`);

            // Get unmatched, unflipped cards
            const available = this._getUnmatchedCards(cards);
            if (available.length < 2) {
                console.log(`[${this.name}] ✅ All cards matched!`);
                return true;
            }

            // Check if we already know a pair
            const knownPair = this._findKnownPair(available);
            if (knownPair) {
                console.log(`[${this.name}] 🎯 Known pair found!`);
                await this._clickCardPair(knownPair[0], knownPair[1]);
                return true;
            }

            // Otherwise: explore — flip two unknown cards
            const unknowns = available.filter(c => !this._cardMemory.has(this._getCardId(c)));

            if (unknowns.length >= 2) {
                // Flip two unknown cards to learn their content
                await this._exploreCards(unknowns[0], unknowns[1]);
            } else if (unknowns.length === 1 && available.length >= 2) {
                // One unknown + one known — flip the unknown first
                const known = available.find(c => this._cardMemory.has(this._getCardId(c)) && c !== unknowns[0]);
                if (known) {
                    await this._exploreCards(unknowns[0], known);
                }
            } else {
                // All cards are known but no pair found — should not happen, but try first two
                if (available.length >= 2) {
                    await this._exploreCards(available[0], available[1]);
                }
            }

            this.stateManager.recordActivity();
            return true;

        } catch (error) {
            this.stateManager.logError(error, this.name);
            return false;
        }
    }

    /**
     * Get all card elements.
     */
    _getCards() {
        for (const sel of this._cardSelectors) {
            try {
                const cards = DOMHelpers.getVisibleElements(sel);
                if (cards.length >= 4) return cards;
            } catch { }
        }

        // Fallback: discover cards by shape/size pattern
        const discovered = GameRouter.discoverSelectors();
        if (discovered.cards.length >= 4) return discovered.cards;

        return [];
    }

    /**
     * Get cards that haven't been matched yet.
     */
    _getUnmatchedCards(cards) {
        return cards.filter(card => {
            const id = this._getCardId(card);
            if (this._matchedPairs.has(id)) return false;

            // Check if card has a "matched" class
            for (const cls of this._matchedClass) {
                if (card.classList.contains(cls)) {
                    this._matchedPairs.add(id);
                    return false;
                }
            }

            // Check CSS: matched cards might be hidden or faded
            const style = window.getComputedStyle(card);
            if (style.opacity === '0' || style.visibility === 'hidden') {
                this._matchedPairs.add(id);
                return false;
            }

            return true;
        });
    }

    /**
     * Get a unique identifier for a card.
     */
    _getCardId(card) {
        return card.id
            || card.dataset.card
            || card.dataset.id
            || card.dataset.index
            || [...card.parentElement.children].indexOf(card).toString();
    }

    /**
     * Read the content of a flipped card.
     */
    _readCardContent(card) {
        // Check for text content in child elements
        const textEl = card.querySelector('.card-front, .card-face, .card-content, .text, span, p');
        if (textEl) {
            const text = DOMHelpers.getTextContent(textEl);
            if (text) return text;
        }

        // Check for images
        const img = card.querySelector('img');
        if (img) return img.src || img.alt || '';

        // Check data attributes
        if (card.dataset.value) return card.dataset.value;
        if (card.dataset.content) return card.dataset.content;
        if (card.dataset.pair) return card.dataset.pair;

        // Fallback: entire card text
        return DOMHelpers.getTextContent(card);
    }

    /**
     * Check if a card is currently flipped (face up).
     */
    _isFlipped(card) {
        for (const cls of this._flippedClass) {
            if (card.classList.contains(cls)) return true;
        }
        return false;
    }

    /**
     * Find a known pair in memory.
     */
    _findKnownPair(availableCards) {
        // Group cards by their content (evaluating math equivalence)
        const entries = [];
        for (const card of availableCards) {
            const id = this._getCardId(card);
            const content = this._cardMemory.get(id);
            if (content) {
                entries.push({ card, id, content });
            }
        }

        // Check all pairs for equivalence
        for (let i = 0; i < entries.length; i++) {
            for (let j = i + 1; j < entries.length; j++) {
                if (MathSolver.areEquivalent(entries[i].content, entries[j].content)) {
                    return [entries[i].card, entries[j].card];
                }
            }
        }

        return null;
    }

    /**
     * Click two cards to explore them (learn their content).
     */
    async _exploreCards(card1, card2) {
        // Click first card
        await this.humanizer.think();
        await this.humanizer.clickElement(card1);

        // Wait for flip animation
        await this.humanizer.wait(400, 800);

        // Read and store content of first card
        const content1 = this._readCardContent(card1);
        const id1 = this._getCardId(card1);
        this._cardMemory.set(id1, content1);
        console.log(`[${this.name}] Card ${id1}: "${content1}"`);

        // Click second card
        await this.humanizer.wait(300, 700);
        await this.humanizer.clickElement(card2);

        // Wait for flip animation
        await this.humanizer.wait(400, 800);

        // Read and store content of second card
        const content2 = this._readCardContent(card2);
        const id2 = this._getCardId(card2);
        this._cardMemory.set(id2, content2);
        console.log(`[${this.name}] Card ${id2}: "${content2}"`);

        // Check if they match
        if (MathSolver.areEquivalent(content1, content2)) {
            console.log(`[${this.name}] 🎉 Match found!`);
            this._matchedPairs.add(id1);
            this._matchedPairs.add(id2);
            this.stateManager.recordCorrect();
        }

        // Wait for cards to flip back (if no match)
        await this.humanizer.wait(800, 1500);
    }

    /**
     * Click a known pair of matching cards.
     */
    async _clickCardPair(card1, card2) {
        await this.humanizer.think();
        await this.humanizer.clickElement(card1);
        await this.humanizer.wait(300, 600);
        await this.humanizer.clickElement(card2);

        const id1 = this._getCardId(card1);
        const id2 = this._getCardId(card2);
        this._matchedPairs.add(id1);
        this._matchedPairs.add(id2);

        this.stateManager.recordCorrect();
        await this.humanizer.wait(500, 1000);
    }

    /**
     * Reset memory (for new game).
     */
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
