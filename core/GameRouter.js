// ============================================
// GameRouter — Game type detection ("Mozek")
// Inspects DOM to determine which game module
// should be activated on the current page.
// ============================================
class GameRouter {

    // ── Real umimeto.org / umimematiku.cz selectors ──
    static GAME_TYPES = {

        // ─── Psaná odpověď (Written Answer / Text Input) ───
        textInput: {
            name: 'Psaná odpověď',
            selectors: [
                '#answer-input',
                'input.answer',
                'input[name="answer"]',
                '.exercise input[type="text"]:not(.search-input)',
                '.exercise input[type="number"]',
                'input[data-answer]'
            ],
            confirmSelectors: [
                '#evaluate', '.exercise-header'
            ],
            urlPatterns: ['/pocitani', '/pocitani-', '/chat', '/slovni-ulohy', '/doplnovani-textu']
        },

        // ─── Rozhodovačka (Choice / Decision) ───
        choice: {
            name: 'Rozhodovačka',
            selectors: [
                '.card[data-index]:not(.pool .card)',
                '.answer-option',
                '.answers .card',
                'button.answer',
                '.options .card'
            ],
            confirmSelectors: [
                '#evaluate', '.exercise-header'
            ],
            urlPatterns: ['/rozhodovacka', '/rozhodovacka-', '/porozumeni', '/oznacovani']
        },

        // ─── Pexeso (Memory / Matching) ───
        pexeso: {
            name: 'Pexeso',
            selectors: [
                '.pexeso .card',
                '.card-grid .card',
                '.memory-card'
            ],
            confirmSelectors: [
                '.exercise-header'
            ],
            urlPatterns: ['/pexeso', '/pexeso-']
        },

        // ─── Přesouvání / Rozdělovačka (Drag & Drop / Sorting) ───
        dragDrop: {
            name: 'Přesouvání',
            selectors: [
                '.pool .card',
                '.pool [data-expr]',
                '.card[data-expr]',
                '[draggable="true"]'
            ],
            confirmSelectors: [
                '.target', '.pool', '#evaluate'
            ],
            urlPatterns: ['/presouvani', '/presouvani-', '/rozdelovacka', '/rozdelovacka-', '/mrizkovana', '/kalkulacka']
        }
    };

    /**
     * Identify the current game type based on DOM inspection + URL.
     * @returns {{ type: string, name: string, confidence: number } | null}
     */
    static identifyGameType() {
        const url = window.location.href;
        const results = [];

        for (const [type, config] of Object.entries(GameRouter.GAME_TYPES)) {
            let score = 0;

            // Check URL patterns
            for (const pattern of config.urlPatterns) {
                if (url.includes(pattern)) {
                    score += 50;
                    break;
                }
            }

            // Check primary selectors (element presence)
            for (const selector of config.selectors) {
                try {
                    const elements = document.querySelectorAll(selector);
                    if (elements.length > 0) {
                        score += 10;
                        score += Math.min(elements.length * 2, 20);
                        break;
                    }
                } catch { }
            }

            // Check confirmation selectors
            for (const selector of config.confirmSelectors) {
                try {
                    if (document.querySelector(selector)) {
                        score += 5;
                    }
                } catch { }
            }

            if (score > 0) {
                results.push({ type, name: config.name, confidence: score });
            }
        }

        // Sort by confidence (highest first)
        results.sort((a, b) => b.confidence - a.confidence);

        if (results.length > 0) {
            console.log(`[GameRouter] 🎮 Detected: ${results[0].name} (confidence: ${results[0].confidence})`);
            if (results.length > 1) {
                console.log('[GameRouter] Other candidates:', results.slice(1).map(r => `${r.name}(${r.confidence})`).join(', '));
            }
            return results[0];
        }

        console.warn('[GameRouter] ⚠️ Could not identify game type');
        return null;
    }

    /**
     * Get all selectors for a given game type.
     */
    static getSelectors(type) {
        return GameRouter.GAME_TYPES[type]?.selectors || [];
    }

    /**
     * Dynamically discover selectors by analyzing the page.
     * Tailored to umimeto.org structure.
     */
    static discoverSelectors() {
        const discovered = {
            inputs: [],
            buttons: [],
            cards: [],
            draggables: [],
            targets: [],
            pool: null,
            taskArea: null
        };

        // Find visible inputs (exclude header search)
        discovered.inputs = DOMHelpers.getVisibleElements(
            'input[type="text"]:not(.search-input), input[type="number"]'
        );

        // Find action buttons (tlacitko class)
        discovered.buttons = DOMHelpers.getVisibleElements('.tlacitko, button.primary, button.secondary');

        // Find cards in pool
        discovered.cards = [...document.querySelectorAll('.pool .card, .card[data-expr]')];

        // Find draggable elements
        discovered.draggables = [...document.querySelectorAll('[draggable="true"], .pool .card')];

        // Find drop targets
        discovered.targets = [...document.querySelectorAll('.target')];

        // Pool
        discovered.pool = document.querySelector('.pool');

        // Task area
        const taskCandidates = ['.exercise-header', '.content-box', 'main', '#app'];
        for (const sel of taskCandidates) {
            const el = document.querySelector(sel);
            if (el) { discovered.taskArea = el; break; }
        }

        return discovered;
    }
}
