// ============================================
// DragDropModule — Module D
// Solves "Přesouvání" / "Rozdělovačka" tasks
//
// Card content strategy (umimeto.org uses blob images):
// 0. Try CanvasInterceptor for text drawn on canvas before blob conversion
// 1. Try NetworkInterceptor for API-captured exercise data
// 2. Try scanning the page's JS state
// 3. Try reading text/KaTeX/data attributes
// 4. Fallback: "Řešení" button to learn correct answer
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
      if (this._isNextVisible()) {
        console.log(`[${this.name}] Clicking "Další"...`);
        await this._clickNext();
        await this.humanizer.wait(800, 1500);
        if (window._canvasInterceptor) window._canvasInterceptor.clearRecent();
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

      let cardValues = this._getValuesFromCanvasInterceptor(cards);
      if (!cardValues) cardValues = this._getValuesFromInterceptor(cards);
      if (!cardValues) cardValues = this._getValuesFromPageState(cards);
      if (!cardValues) cardValues = this._getValuesFromDOM(cards);

      if (!cardValues) {
        console.log(`[${this.name}] 🔍 Cannot read card values. Using "Řešení" strategy...`);
        await this._solveViaSolution(cards, targets);
        return true;
      }

      console.log(`[${this.name}] 📊 Card values: ${cardValues.map(v => v.value).join(', ')}`);

      const cardData = cards.map((card, i) => ({
        element: card,
        content: cardValues[i]?.content || '',
        value: cardValues[i]?.value ?? null,
        index: i
      }));

      // Read target values
      let targetValues = this._getValuesFromCanvasInterceptor(targets);
      if (!targetValues) targetValues = this._getTargetValuesFromDOM(targets);

      const targetData = targets.map((target, i) => ({
        element: target,
        content: targetValues ? (targetValues[i]?.content || '') : this._readCardContent(target),
        index: this._getIndex(target),
        value: targetValues ? targetValues[i]?.value : MathSolver.evaluate(MathSolver._normalizeExpression(this._readCardContent(target))),
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
        if (window._canvasInterceptor) window._canvasInterceptor.clearRecent();
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

  _getValuesFromCanvasInterceptor(elements) {
    if (!window._canvasInterceptor) return null;
    let hasValues = false;
    const values = elements.map(el => {
      const text = window._canvasInterceptor.getTextForCard(el);
      if (text) {
        const val = MathSolver.evaluate(MathSolver._normalizeExpression(text));
        if (val !== null) hasValues = true;
        return { content: text, value: val };
      }
      return { content: '', value: null };
    });
    return hasValues ? values : null;
  }

  _getValuesFromInterceptor(cards) {
    if (!window._networkInterceptor) return null;
    const items = window._networkInterceptor.getExerciseItems();
    if (!items || items.length === 0) return null;

    console.log(`[${this.name}] 🌐 Interceptor has ${items.length} items`);
    const values = [];
    for (let i = 0; i < cards.length; i++) {
        const item = i < items.length ? items[i] : null;
        values.push(this._extractValueFromItem(item));
    }
    return values.some(v => v.value !== null) ? values : null;
  }

  _getValuesFromPageState(cards) {
    const scanResult = NetworkInterceptor.scanPageState();
    if (!scanResult.items || scanResult.items.length === 0) return null;

    console.log(`[${this.name}] 🔍 Page state scan found ${scanResult.items.length} items from: ${scanResult.source}`);
    const values = [];
    for (let i = 0; i < cards.length; i++) {
        const item = i < scanResult.items.length ? scanResult.items[i] : null;
        values.push(this._extractValueFromItem(item));
    }
    return values.some(v => v.value !== null) ? values : null;
  }

  _getValuesFromDOM(cards) {
    const values = cards.map(card => {
      const content = this._readCardContent(card);
      const value = content ? MathSolver.evaluate(MathSolver._normalizeExpression(content)) : null;
      return { content, value };
    });
    return values.some(v => v.value !== null) ? values : null;
  }

  _getTargetValuesFromDOM(targets) {
    const values = targets.map(target => {
      const content = this._readCardContent(target);
      const value = content ? MathSolver.evaluate(MathSolver._normalizeExpression(content)) : null;
      return { content, value };
    });
    return values.some(v => v.value !== null) ? values : null;
  }

  async _solveViaSolution(cards, targets) {
    const solutionBtn = document.querySelector('#solution');
    if (solutionBtn && DOMHelpers.isVisible(solutionBtn)) {
      console.log(`[${this.name}] 📖 Clicking "Řešení" to learn answer...`);
      await this.humanizer.clickElement(solutionBtn);
      await this.humanizer.wait(1000, 2000);

      // Wait for solution and then click "Další"
      await this.humanizer.wait(500, 1000);
      if (this._isNextVisible()) {
        await this._clickNext();
        if (window._canvasInterceptor) window._canvasInterceptor.clearRecent();
      }
      return;
    }

    const giveUpBtn = document.querySelector('#give-up');
    if (giveUpBtn && DOMHelpers.isVisible(giveUpBtn)) {
      console.log(`[${this.name}] 🤷 Clicking "Nevím"...`);
      await this.humanizer.clickElement(giveUpBtn);
      await this.humanizer.wait(1500, 2500);
      if (this._isNextVisible()) {
        await this._clickNext();
        if (window._canvasInterceptor) window._canvasInterceptor.clearRecent();
      }
      return;
    }

    // Attempt to match if CanvasInterceptor accumulated texts and we can sort them
    if (window._canvasInterceptor && window._canvasInterceptor.getRecentTexts(cards.length).length === cards.length) {
      const recent = window._canvasInterceptor.getRecentTexts(cards.length);
      console.log(`[${this.name}] 🧠 Guessing from recent canvas texts: ${recent.join(', ')}`);
      
      const sortedTargets = [...targets].sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
      
      const parsedValues = recent.map(t => ({ text: t, val: MathSolver.evaluate(MathSolver._normalizeExpression(t)) }));
      
      if (parsedValues.every(v => v.val !== null)) {
         parsedValues.sort((a,b) => a.val - b.val);
         for (let i = 0; i < Math.min(cards.length, sortedTargets.length); i++) {
           await this.humanizer.think();
           await this.humanizer.dragTo(cards[i], sortedTargets[i]);
           await this.humanizer.wait(300, 700);
         }
         return;
      }
    }

    console.log(`[${this.name}] 🎲 No strategy available, placing in order...`);
    const sortedTargets = [...targets].sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
    for (let i = 0; i < Math.min(cards.length, sortedTargets.length); i++) {
      await this.humanizer.think();
      await this.humanizer.dragTo(cards[i], sortedTargets[i]);
      await this.humanizer.wait(300, 700);
    }
  }

  _extractValueFromItem(item) {
    if (!item) return { content: '', value: null };
    if (typeof item !== 'object') return { content: String(item), value: parseFloat(item) || null };

    const valueKeys = ['value', 'val', 'expr', 'expression', 'number', 'num', 'answer', 'text', 'label', 'content', 'fraction', 'frac', 'x'];
    for (const key of valueKeys) {
      if (item[key] !== undefined && item[key] !== null) {
        const raw = String(item[key]);
        const num = MathSolver.evaluate(MathSolver._normalizeExpression(raw));
        if (num !== null) return { content: raw, value: num };
      }
    }
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
      console.warn(`[${this.name}] ⚠️ No values! Cannot sort correctly.`);
      return;
    }

    for (let i = 0; i < Math.min(valued.length, sorted.length); i++) {
      console.log(`[${this.name}] 📐 "${valued[i].content}" (${valued[i].value}) → pos ${i + 1}`);
      await this.humanizer.think();
      await this.humanizer.dragTo(valued[i].element, sorted[i].element);
      await this.humanizer.wait(300, 700);
    }
    
    // Fallback for remaining unknown cards
    const remainingCards = cards.filter(c => c.value === null);
    if (remainingCards.length > 0 && sorted.length > valued.length) {
      for (let i = 0; i < remainingCards.length; i++) {
        const tgtIdx = valued.length + i;
        if (tgtIdx < sorted.length) {
          console.log(`[${this.name}] 📐 Placing unknown card at position ${tgtIdx + 1}`);
          await this.humanizer.think();
          await this.humanizer.dragTo(remainingCards[i].element, sorted[tgtIdx].element);
          await this.humanizer.wait(300, 700);
        }
      }
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
    const range = (target.content||'').match(/(-?[\d.,]+)\s*[-–]\s*(-?[\d.,]+)/);
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
