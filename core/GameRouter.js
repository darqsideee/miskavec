// ============================================
// GameRouter — Game type detection ("Mozek")
// Inspects DOM to determine which game module
// should be activated on the current page.
// ============================================
class GameRouter {

    // All supported game types with detection selectors (priority-ordered)
    static GAME_TYPES = {
        // ─── Psaná odpověď (Written Answer / Text Input) ───
        textInput: {
            name: 'Psaná odpověď',
            selectors: [
                'input.answer', 'input[name="answer"]',
                'input[type="text"][class*="answer"]',
                'input[type="number"][class*="answer"]',
                '.task input[type="text"]',
                '.task input[type="number"]',
                '.exercise input[type="text"]',
                'input.form-control',
                '#answer-input',
                'input[data-answer]'
            ],
            // Additional conditions to confirm this is the right module
            confirmSelectors: [
                '.task', '.question', '.exercise', '[class*="task"]'
            ],
            urlPatterns: ['/pocitani', '/chat', '/slovni-ulohy', '/doplnovani-textu']
        },

        // ─── Rozhodovačka (Choice / Decision) ───
        choice: {
            name: 'Rozhodovačka',
            selectors: [
                '.board button.answer',
                '.board .answer-button',
                'button[class*="answer"]',
                '.answers button',
                '.options button',
                '.choices button',
                '.alternatives button',
                '[class*="answer-btn"]',
                '.answer-option',
                'button[data-answer]'
            ],
            confirmSelectors: [
                '.task', '.question', '.exercise'
            ],
            urlPatterns: ['/rozhodovacka', '/porozumeni', '/oznacovani']
        },

        // ─── Pexeso (Memory / Matching) ───
        pexeso: {
            name: 'Pexeso',
            selectors: [
                '.pexeso-card', '.card[class*="pexeso"]',
                '.memory-card', '[class*="pexeso"]',
                '.card-grid .card',
                '.game-card',
                '[data-card]'
            ],
            confirmSelectors: [],
            urlPatterns: ['/pexeso']
        },

        // ─── Přesouvání / Rozdělovačka (Drag & Drop / Sorting) ───
        dragDrop: {
            name: 'Přesouvání',
            selectors: [
                '[draggable="true"]',
                '.draggable', '.drag-item',
                '[class*="draggable"]',
                '[class*="sortable"]',
                '.drop-zone', '.drop-target',
                '[class*="drop-zone"]',
                '.puzzle-piece'
            ],
            confirmSelectors: [
                '.drop-zone', '.drop-target', '[class*="drop"]',
                '.target-area', '.category'
            ],
            urlPatterns: ['/presouvani', '/rozdelovacka', '/mrizkovana', '/kalkulacka']
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
                    score += 50; // Strong signal
                    break;
                }
            }

            // Check primary selectors (element presence)
            for (const selector of config.selectors) {
                try {
                    const elements = document.querySelectorAll(selector);
                    if (elements.length > 0) {
                        score += 10;
                        // More elements = higher confidence
                        score += Math.min(elements.length * 2, 20);
                        break;
                    }
                } catch { /* invalid selector */ }
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
     * Fallback when standard selectors don't match.
     */
    static discoverSelectors() {
        const discovered = {
            inputs: [],
            buttons: [],
            cards: [],
            draggables: [],
            taskArea: null
        };

        // Find all visible inputs
        discovered.inputs = DOMHelpers.getVisibleElements('input[type="text"], input[type="number"], input:not([type])');

        // Find all visible buttons with text
        discovered.buttons = DOMHelpers.getVisibleElements('button, [role="button"], .btn')
            .filter(b => b.textContent.trim().length > 0 && b.textContent.trim().length < 100);

        // Find elements that look like cards (similar-sized, multiple)
        const allDivs = document.querySelectorAll('div, span, li');
        const sizeGroups = new Map();
        for (const div of allDivs) {
            const rect = div.getBoundingClientRect();
            if (rect.width > 30 && rect.height > 30 && rect.width < 300 && rect.height < 300) {
                const key = `${Math.round(rect.width / 10) * 10}x${Math.round(rect.height / 10) * 10}`;
                if (!sizeGroups.has(key)) sizeGroups.set(key, []);
                sizeGroups.get(key).push(div);
            }
        }
        // Groups of 6+ similar-sized elements could be cards
        for (const [, group] of sizeGroups) {
            if (group.length >= 6) {
                discovered.cards.push(...group);
                break;
            }
        }

        // Find draggable elements
        discovered.draggables = [...document.querySelectorAll('[draggable="true"]')];

        // Find task area
        const taskCandidates = ['main', '.board', '.task', '.question', '.exercise', '.content', '#app'];
        for (const sel of taskCandidates) {
            const el = document.querySelector(sel);
            if (el) { discovered.taskArea = el; break; }
        }

        return discovered;
    }
}
