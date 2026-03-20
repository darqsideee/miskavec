// ============================================
// DragDropModule — Module D
// Solves "Přesouvání" / "Rozdělovačka" tasks
// Drag items to correct targets via simulated
// PointerEvents along Bezier curves.
// ============================================
class DragDropModule extends BaseModule {

    constructor(humanizer, stateManager) {
        super(humanizer, stateManager);
        this.name = 'DragDropModule';
        this._draggableSelectors = [
            '[draggable="true"]',
            '.draggable', '.drag-item',
            '[class*="draggable"]', '[class*="drag-item"]',
            '.puzzle-piece', '.sortable-item',
            '.board .item'
        ];
        this._dropTargetSelectors = [
            '.drop-zone', '.drop-target',
            '[class*="drop-zone"]', '[class*="drop-target"]',
            '.target-area', '.category',
            '[class*="target"]', '[class*="slot"]',
            '.placeholder', '.destination'
        ];
    }

    canHandle() {
        const draggables = this._getDraggables();
        const targets = this._getDropTargets();
        return draggables.length > 0 && targets.length > 0;
    }

    async solve() {
        try {
            const draggables = this._getDraggables();
            const targets = this._getDropTargets();

            if (draggables.length === 0 || targets.length === 0) {
                console.warn(`[${this.name}] Missing elements: ${draggables.length} draggables, ${targets.length} targets`);
                return false;
            }

            console.log(`[${this.name}] 📦 Found ${draggables.length} draggable items and ${targets.length} drop targets`);

            // Determine task type
            const taskType = this._determineTaskType(draggables, targets);
            console.log(`[${this.name}] Task type: ${taskType}`);

            switch (taskType) {
                case 'sorting':
                    await this._solveSorting(draggables, targets);
                    break;
                case 'ordering':
                    await this._solveOrdering(draggables, targets);
                    break;
                case 'matching':
                    await this._solveMatching(draggables, targets);
                    break;
                default:
                    await this._solveGeneric(draggables, targets);
            }

            this.stateManager.recordActivity();
            return true;

        } catch (error) {
            this.stateManager.logError(error, this.name);
            return false;
        }
    }

    /**
     * Get all draggable elements.
     */
    _getDraggables() {
        for (const sel of this._draggableSelectors) {
            try {
                const items = DOMHelpers.getVisibleElements(sel);
                if (items.length > 0) return items;
            } catch { }
        }
        return [];
    }

    /**
     * Get all drop target elements.
     */
    _getDropTargets() {
        for (const sel of this._dropTargetSelectors) {
            try {
                const targets = DOMHelpers.getVisibleElements(sel);
                if (targets.length > 0) return targets;
            } catch { }
        }
        return [];
    }

    /**
     * Determine the type of drag & drop task.
     */
    _determineTaskType(draggables, targets) {
        const url = window.location.href;

        if (url.includes('rozdelovacka')) return 'sorting';
        if (url.includes('presouvani')) {
            // Check if targets have labels (sorting) or are ordered slots (ordering)
            const targetTexts = targets.map(t => DOMHelpers.getTextContent(t));
            const hasLabels = targetTexts.some(t => t.length > 0);
            if (hasLabels) return 'sorting';
            return 'matching';
        }

        // Heuristic: if targets have text/labels → sorting
        // If targets are empty slots in a sequence → ordering
        // If targets match count of draggables → matching
        const targetTexts = targets.map(t => DOMHelpers.getTextContent(t));
        const hasLabels = targetTexts.some(t => t.length > 0);
        if (hasLabels) return 'sorting';
        if (targets.length === draggables.length) return 'matching';
        return 'ordering';
    }

    /**
     * Solve sorting tasks (drag items into categories).
     */
    async _solveSorting(draggables, targets) {
        for (const item of draggables) {
            const itemText = DOMHelpers.getTextContent(item);
            const itemValue = MathSolver.evaluate(MathSolver._normalizeExpression(itemText));

            let bestTarget = null;
            let bestScore = -1;

            for (const target of targets) {
                const targetText = DOMHelpers.getTextContent(target);
                const score = this._matchScore(itemText, itemValue, targetText, target);
                if (score > bestScore) {
                    bestScore = score;
                    bestTarget = target;
                }
            }

            if (bestTarget) {
                console.log(`[${this.name}] 🎯 Dragging "${itemText}" → "${DOMHelpers.getTextContent(bestTarget)}"`);
                await this.humanizer.think();
                await this.humanizer.dragTo(item, bestTarget);
                await this.humanizer.afterAction();
            }
        }
    }

    /**
     * Solve ordering tasks (arrange items in sequence).
     */
    async _solveOrdering(draggables, targets) {
        // Get all item values
        const items = draggables.map(el => ({
            element: el,
            text: DOMHelpers.getTextContent(el),
            value: MathSolver.evaluate(MathSolver._normalizeExpression(DOMHelpers.getTextContent(el)))
        }));

        // Sort by numerical value (ascending)
        items.sort((a, b) => {
            if (a.value !== null && b.value !== null) return a.value - b.value;
            return a.text.localeCompare(b.text);
        });

        // Drag each to corresponding target slot
        for (let i = 0; i < Math.min(items.length, targets.length); i++) {
            console.log(`[${this.name}] 📐 Ordering: "${items[i].text}" → slot ${i + 1}`);
            await this.humanizer.think();
            await this.humanizer.dragTo(items[i].element, targets[i]);
            await this.humanizer.afterAction();
        }
    }

    /**
     * Solve matching tasks (1:1 item-to-target).
     */
    async _solveMatching(draggables, targets) {
        const items = draggables.map(el => ({
            element: el,
            text: DOMHelpers.getTextContent(el),
            value: MathSolver.evaluate(MathSolver._normalizeExpression(DOMHelpers.getTextContent(el)))
        }));

        const targetData = targets.map(el => ({
            element: el,
            text: DOMHelpers.getTextContent(el),
            value: MathSolver.evaluate(MathSolver._normalizeExpression(DOMHelpers.getTextContent(el)))
        }));

        // Pair items with targets by value equivalence
        const used = new Set();
        for (const item of items) {
            for (let j = 0; j < targetData.length; j++) {
                if (used.has(j)) continue;
                const target = targetData[j];
                if (item.value !== null && target.value !== null && Math.abs(item.value - target.value) < 0.001) {
                    console.log(`[${this.name}] 🔗 Matching: "${item.text}" → "${target.text}"`);
                    await this.humanizer.think();
                    await this.humanizer.dragTo(item.element, target.element);
                    used.add(j);
                    await this.humanizer.afterAction();
                    break;
                }
            }
        }
    }

    /**
     * Generic solve: try best-effort placement.
     */
    async _solveGeneric(draggables, targets) {
        for (let i = 0; i < draggables.length; i++) {
            const target = targets[i % targets.length];
            const itemText = DOMHelpers.getTextContent(draggables[i]);
            console.log(`[${this.name}] 📦 Generic drag: "${itemText}" → target ${i + 1}`);
            await this.humanizer.think();
            await this.humanizer.dragTo(draggables[i], target);
            await this.humanizer.afterAction();
        }
    }

    /**
     * Score how well an item matches a target.
     */
    _matchScore(itemText, itemValue, targetText, targetElement) {
        let score = 0;

        // Check text containment
        if (targetText && itemText) {
            if (targetText.toLowerCase().includes(itemText.toLowerCase())) score += 10;
            if (itemText.toLowerCase().includes(targetText.toLowerCase())) score += 10;
        }

        // Check math equivalence
        const targetValue = MathSolver.evaluate(MathSolver._normalizeExpression(targetText));
        if (itemValue !== null && targetValue !== null) {
            if (Math.abs(itemValue - targetValue) < 0.001) score += 20;
        }

        // Check data attributes
        const targetData = targetElement.dataset;
        if (targetData.value && MathSolver.areEquivalent(itemText, targetData.value)) score += 15;
        if (targetData.category && itemText.includes(targetData.category)) score += 15;

        // Check range-based targets (e.g., "0-10", "11-20")
        const rangeMatch = targetText.match(/(\d+)\s*[-–]\s*(\d+)/);
        if (rangeMatch && itemValue !== null) {
            const low = parseFloat(rangeMatch[1]);
            const high = parseFloat(rangeMatch[2]);
            if (itemValue >= low && itemValue <= high) score += 25;
        }

        return score;
    }

    getState() {
        return {
            ...super.getState(),
            draggableCount: this._getDraggables().length,
            targetCount: this._getDropTargets().length
        };
    }
}
