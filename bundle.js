// ╔══════════════════════════════════════════════════╗
// ║  UmimeTo Solver v1.0                            ║
// ║  github.com/darqsideee/miskavec                 ║
// ║  Auto-generated bundle — do not edit directly    ║
// ║  Built: 2026-03-20T20:18:00              ║
// ╚══════════════════════════════════════════════════╝

(function() {
"use strict";


// ── src/utils/DOMHelpers.js ─────────────────────────────

// ============================================
// DOMHelpers — Common DOM query utilities
// ============================================
class DOMHelpers {
  /**
   * Wait for an element to appear in the DOM.
   * @param {string} selector - CSS selector
   * @param {number} timeout - Max wait time in ms (default 10s)
   * @param {Element} parent - Parent element to search within
   * @returns {Promise<Element>}
   */
  static waitForElement(selector, timeout = 10000, parent = document) {
    return new Promise((resolve, reject) => {
      const existing = parent.querySelector(selector);
      if (existing) return resolve(existing);

      const observer = new MutationObserver(() => {
        const el = parent.querySelector(selector);
        if (el) {
          observer.disconnect();
          resolve(el);
        }
      });

      observer.observe(parent, { childList: true, subtree: true });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`[DOMHelpers] Timeout waiting for: ${selector}`));
      }, timeout);
    });
  }

  /**
   * Wait for any of the given selectors to appear.
   * @param {string[]} selectors
   * @param {number} timeout
   * @returns {Promise<{element: Element, selector: string}>}
   */
  static waitForAny(selectors, timeout = 10000) {
    return new Promise((resolve, reject) => {
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) return resolve({ element: el, selector: sel });
      }

      const observer = new MutationObserver(() => {
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el) {
            observer.disconnect();
            return resolve({ element: el, selector: sel });
          }
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`[DOMHelpers] Timeout waiting for any of: ${selectors.join(', ')}`));
      }, timeout);
    });
  }

  /**
   * Extract cleaned text content from an element.
   */
  static getTextContent(selectorOrElement) {
    const el = typeof selectorOrElement === 'string'
      ? document.querySelector(selectorOrElement)
      : selectorOrElement;
    if (!el) return '';
    return el.textContent.trim().replace(/\s+/g, ' ');
  }

  /**
   * Get all visible elements matching a selector.
   */
  static getVisibleElements(selector, parent = document) {
    return [...parent.querySelectorAll(selector)].filter(el => {
      const style = window.getComputedStyle(el);
      return style.display !== 'none'
          && style.visibility !== 'hidden'
          && style.opacity !== '0'
          && el.offsetParent !== null;
    });
  }

  /**
   * Get the center coordinates of an element's bounding rect.
   */
  static getBoundingCenter(element) {
    const rect = element.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      rect
    };
  }

  /**
   * Query multiple selectors, return first match.
   */
  static queryFirst(selectors, parent = document) {
    for (const sel of selectors) {
      const el = parent.querySelector(sel);
      if (el) return { element: el, selector: sel };
    }
    return null;
  }

  /**
   * Query multiple selectors, return all matches (merged).
   */
  static queryAll(selectors, parent = document) {
    const results = [];
    for (const sel of selectors) {
      results.push(...parent.querySelectorAll(sel));
    }
    return results;
  }

  /**
   * Check if an element exists and is visible.
   */
  static isVisible(selectorOrElement) {
    const el = typeof selectorOrElement === 'string'
      ? document.querySelector(selectorOrElement)
      : selectorOrElement;
    if (!el) return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none'
        && style.visibility !== 'hidden'
        && style.opacity !== '0'
        && el.offsetParent !== null;
  }

  /**
   * Dispatch a native InputEvent on an element.
   */
  static dispatchInputEvent(element, value) {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    )?.set;
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(element, value);
    } else {
      element.value = value;
    }
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }
}


// ── src/utils/MathSolver.js ─────────────────────────────

// ============================================
// MathSolver — Lightweight math expression evaluator
// No external dependencies. Handles arithmetic,
// fractions, basic equations, comparisons, units.
// ============================================
class MathSolver {

    /**
     * Main entry: try to solve whatever text is given.
     * Returns the answer as a string, or null.
     */
    static solve(text) {
        if (!text || typeof text !== 'string') return null;

        // Normalize text
        let expr = text.trim();
        expr = MathSolver._normalizeExpression(expr);

        // Try strategies in order
        return MathSolver._tryComparison(expr)
            ?? MathSolver._tryEquation(expr)
            ?? MathSolver._tryArithmetic(expr)
            ?? null;
    }

    // ── Normalization ──────────────────────────────

    static _normalizeExpression(expr) {
        return expr
            .replace(/×/g, '*')
            .replace(/⋅/g, '*')
            .replace(/·/g, '*')
            .replace(/÷/g, '/')
            .replace(/−/g, '-')
            .replace(/–/g, '-')
            .replace(/—/g, '-')
            .replace(/²/g, '**2')
            .replace(/³/g, '**3')
            .replace(/√(\d+)/g, 'Math.sqrt($1)')
            .replace(/\^/g, '**')
            .replace(/\s+/g, ' ')
            .trim();
    }

    // ── Arithmetic evaluation ─────────────────────

    static _tryArithmetic(expr) {
        try {
            // Check if it contains an = sign asking for result
            // E.g. "5 + 3 =" or "5 + 3 = ?"
            let toEval = expr;
            if (/=\s*[?_]?\s*$/.test(toEval)) {
                toEval = toEval.replace(/=\s*[?_]?\s*$/, '').trim();
            }
            // Remove trailing = if present
            if (toEval.endsWith('=')) {
                toEval = toEval.slice(0, -1).trim();
            }

            // Safety: only allow safe math characters
            if (!/^[\d\s+\-*/().,%Math.sqrtpowabsceilfloorround]+$/i.test(toEval)) {
                // Try fraction parsing
                const fracResult = MathSolver._tryFraction(toEval);
                if (fracResult !== null) return fracResult;
                return null;
            }

            const result = MathSolver._safeEval(toEval);
            if (result === null || result === undefined || isNaN(result) || !isFinite(result)) return null;

            return MathSolver._formatResult(result);
        } catch {
            return null;
        }
    }

    // ── Safe evaluation (no actual eval) ──────────

    static _safeEval(expression) {
        try {
            // Use Function constructor with restricted scope for safety
            const sanitized = expression
                .replace(/Math\./g, '__MATH__.')
                .trim();

            // Double-check: only allow digits, operators and parens
            if (!/^[\d\s+\-*/().e__MATH__sqrtpowabs]+$/i.test(sanitized)) {
                return null;
            }

            const fn = new Function('__MATH__', `"use strict"; return (${sanitized});`);
            return fn(Math);
        } catch {
            return null;
        }
    }

    // ── Fraction handling ─────────────────────────

    static _tryFraction(expr) {
        // Match patterns like "3/4", "1 2/3" (mixed numbers)
        const mixedMatch = expr.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
        if (mixedMatch) {
            const whole = parseInt(mixedMatch[1]);
            const num = parseInt(mixedMatch[2]);
            const den = parseInt(mixedMatch[3]);
            if (den === 0) return null;
            const result = whole + num / den;
            return MathSolver._formatResult(result);
        }

        const fracMatch = expr.match(/^(\d+)\s*\/\s*(\d+)$/);
        if (fracMatch) {
            const num = parseInt(fracMatch[1]);
            const den = parseInt(fracMatch[2]);
            if (den === 0) return null;
            return MathSolver._formatResult(num / den);
        }

        return null;
    }

    // ── Equation solving ──────────────────────────

    static _tryEquation(expr) {
        // Pattern: "expression = ?" or "? = expression" or "x + 5 = 12"
        if (!expr.includes('=')) return null;

        const parts = expr.split('=').map(s => s.trim());
        if (parts.length !== 2) return null;

        const [left, right] = parts;

        // Case: "expression = ?" → evaluate left side
        if (right === '?' || right === '_' || right === '') {
            return MathSolver._tryArithmetic(left);
        }

        // Case: "? = expression" → evaluate right side
        if (left === '?' || left === '_' || left === '') {
            return MathSolver._tryArithmetic(right);
        }

        // Case: simple linear equation with x
        // "x + 5 = 12" or "3 * x = 15"
        if (/[xXyY]/.test(left) || /[xXyY]/.test(right)) {
            return MathSolver._solveLinearEquation(left, right);
        }

        // Case: "_ + 5 = 12" (fill in the blank)
        if (/[_□■]/.test(left) || /[_□■]/.test(right)) {
            return MathSolver._solveBlankEquation(left, right);
        }

        return null;
    }

    static _solveLinearEquation(left, right) {
        try {
            // Move everything to left side: left - right = 0
            // Substitute x with a symbolic value and solve numerically
            // Simple approach: try values or use algebraic solution for ax + b = 0
            const variable = /[xX]/.test(left + right) ? 'x' : 'y';

            // Evaluate f(x) = left - right at two points to find linear solution
            const f = (val) => {
                const evalSide = (side) => {
                    const replaced = side
                        .replace(new RegExp(variable, 'gi'), `(${val})`)
                        .replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
                    return MathSolver._safeEval(replaced);
                };
                const l = evalSide(left);
                const r = evalSide(right);
                if (l === null || r === null) return null;
                return l - r;
            };

            const f0 = f(0);
            const f1 = f(1);
            if (f0 === null || f1 === null) return null;

            // For linear equation: f(x) = ax + b
            // f(0) = b, f(1) = a + b → a = f(1) - f(0)
            const b = f0;
            const a = f1 - f0;

            if (a === 0) {
                return b === 0 ? '0' : null; // No solution or infinite solutions
            }

            const solution = -b / a;

            // Verify solution
            const check = f(solution);
            if (check !== null && Math.abs(check) > 0.001) return null;

            return MathSolver._formatResult(solution);
        } catch {
            return null;
        }
    }

    static _solveBlankEquation(left, right) {
        try {
            // Replace blank with x and solve
            const newLeft = left.replace(/[_□■]/g, 'x');
            const newRight = right.replace(/[_□■]/g, 'x');
            return MathSolver._solveLinearEquation(newLeft, newRight);
        } catch {
            return null;
        }
    }

    // ── Comparison evaluation ─────────────────────

    static _tryComparison(expr) {
        // Check for comparison operators: >, <, >=, <=
        const compMatch = expr.match(/^(.+?)\s*([><=≥≤≠]+)\s*(.+)$/);
        if (!compMatch) return null;

        const leftStr = compMatch[1].trim();
        const op = compMatch[2].trim();
        const rightStr = compMatch[3].trim();

        // If one side has "?" → it's asking which operator to choose
        if (leftStr === '?' || rightStr === '?') return null;

        const leftVal = MathSolver._safeEval(MathSolver._normalizeExpression(leftStr));
        const rightVal = MathSolver._safeEval(MathSolver._normalizeExpression(rightStr));

        if (leftVal === null || rightVal === null) return null;

        // Determine correct comparison
        if (leftVal > rightVal) return '>';
        if (leftVal < rightVal) return '<';
        return '=';
    }

    // ── Evaluate a single expression to a number ──

    static evaluate(expr) {
        if (!expr || typeof expr !== 'string') return null;
        const normalized = MathSolver._normalizeExpression(expr);
        const result = MathSolver._safeEval(normalized);
        if (result === null || isNaN(result) || !isFinite(result)) {
            return MathSolver._tryFractionEval(normalized);
        }
        return result;
    }

    static _tryFractionEval(expr) {
        const fracMatch = expr.match(/^(-?\d+)\s*\/\s*(-?\d+)$/);
        if (fracMatch) {
            const num = parseInt(fracMatch[1]);
            const den = parseInt(fracMatch[2]);
            if (den === 0) return null;
            return num / den;
        }
        return null;
    }

    // ── Unit conversion ───────────────────────────

    static convertUnit(value, fromUnit, toUnit) {
        const conversions = {
            // Length (base: meter)
            'mm': 0.001, 'cm': 0.01, 'dm': 0.1, 'm': 1, 'km': 1000,
            // Mass (base: gram)
            'mg': 0.001, 'g': 1, 'dkg': 10, 'dag': 10, 'kg': 1000, 't': 1000000,
            // Area (base: m²)
            'mm2': 0.000001, 'cm2': 0.0001, 'dm2': 0.01, 'm2': 1, 'a': 100, 'ha': 10000, 'km2': 1000000,
            // Volume (base: liter)
            'ml': 0.001, 'cl': 0.01, 'dl': 0.1, 'l': 1, 'hl': 100,
            // Time (base: seconds)
            's': 1, 'min': 60, 'h': 3600, 'hod': 3600,
        };

        const fromFactor = conversions[fromUnit.toLowerCase()];
        const toFactor = conversions[toUnit.toLowerCase()];
        if (!fromFactor || !toFactor) return null;

        return (value * fromFactor) / toFactor;
    }

    // ── Result formatting ─────────────────────────

    static _formatResult(num) {
        if (Number.isInteger(num)) return num.toString();
        // Round to avoid floating point artifacts
        const rounded = Math.round(num * 1000000) / 1000000;
        if (Number.isInteger(rounded)) return rounded.toString();
        return rounded.toString().replace('.', ','); // Czech decimal separator
    }

    /**
     * Check if two values represent the same mathematical value.
     * Useful for Pexeso matching.
     */
    static areEquivalent(a, b) {
        const valA = MathSolver.evaluate(MathSolver._normalizeExpression(a));
        const valB = MathSolver.evaluate(MathSolver._normalizeExpression(b));
        if (valA === null || valB === null) return a.trim() === b.trim();
        return Math.abs(valA - valB) < 0.0001;
    }
}


// ── src/humanizer/BezierMouse.js ────────────────────────

// ============================================
// BezierMouse — Curved mouse movement simulation
// Generates human-like mouse paths using cubic 
// Bezier curves with randomized control points.
// ============================================
class BezierMouse {

    /**
     * Generate a cubic Bezier curve path from point A to point B.
     * @param {number} x1 - Start X
     * @param {number} y1 - Start Y
     * @param {number} x2 - End X
     * @param {number} y2 - End Y
     * @param {number} steps - Number of intermediate points
     * @returns {{x: number, y: number}[]} Array of points along the curve
     */
    static generatePath(x1, y1, x2, y2, steps = 20) {
        // Distance between start and end
        const dx = x2 - x1;
        const dy = y2 - y1;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Randomize control points (perpendicular spread proportional to distance)
        const spread = dist * 0.3;
        const cp1 = {
            x: x1 + dx * 0.25 + (Math.random() - 0.5) * spread,
            y: y1 + dy * 0.25 + (Math.random() - 0.5) * spread
        };
        const cp2 = {
            x: x1 + dx * 0.75 + (Math.random() - 0.5) * spread,
            y: y1 + dy * 0.75 + (Math.random() - 0.5) * spread
        };

        const path = [];
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            // Add slight time jitter for more natural feel
            const jitteredT = Math.max(0, Math.min(1,
                t + (Math.random() - 0.5) * 0.02
            ));
            path.push(BezierMouse._cubicBezier(x1, y1, cp1.x, cp1.y, cp2.x, cp2.y, x2, y2, jitteredT));
        }

        // Ensure exact endpoint
        path[path.length - 1] = { x: x2, y: y2 };

        return path;
    }

    /**
     * Evaluate cubic Bezier at parameter t.
     */
    static _cubicBezier(x1, y1, cx1, cy1, cx2, cy2, x2, y2, t) {
        const u = 1 - t;
        const uu = u * u;
        const uuu = uu * u;
        const tt = t * t;
        const ttt = tt * t;

        return {
            x: uuu * x1 + 3 * uu * t * cx1 + 3 * u * tt * cx2 + ttt * x2,
            y: uuu * y1 + 3 * uu * t * cy1 + 3 * u * tt * cy2 + ttt * y2
        };
    }

    /**
     * Dispatch mousemove events along a Bezier path to an element.
     * @param {number} fromX - Start X
     * @param {number} fromY - Start Y
     * @param {number} toX - End X
     * @param {number} toY - End Y
     * @param {number} duration - Total duration in ms (default 300-600ms)
     * @returns {Promise<void>}
     */
    static async moveTo(fromX, fromY, toX, toY, duration = null) {
        duration = duration ?? (300 + Math.random() * 300);
        const steps = Math.max(10, Math.floor(duration / 16)); // ~60fps
        const path = BezierMouse.generatePath(fromX, fromY, toX, toY, steps);
        const stepDelay = duration / steps;

        for (const point of path) {
            const el = document.elementFromPoint(point.x, point.y);
            if (el) {
                el.dispatchEvent(new MouseEvent('mousemove', {
                    clientX: point.x,
                    clientY: point.y,
                    bubbles: true,
                    cancelable: true,
                    view: window
                }));
            }
            await new Promise(r => setTimeout(r, stepDelay + (Math.random() - 0.5) * 4));
        }
    }

    /**
     * Get the current "virtual" mouse position (center of viewport as default).
     */
    static getCurrentPosition() {
        return {
            x: BezierMouse._lastX ?? (window.innerWidth / 2),
            y: BezierMouse._lastY ?? (window.innerHeight / 2)
        };
    }

    static _lastX = null;
    static _lastY = null;

    /**
     * Track mouse movement to know current position.
     */
    static init() {
        document.addEventListener('mousemove', (e) => {
            BezierMouse._lastX = e.clientX;
            BezierMouse._lastY = e.clientY;
        }, { passive: true });
    }
}


// ── src/humanizer/Humanizer.js ──────────────────────────

// ============================================
// Humanizer — Human-like interaction simulation
// Delays, natural typing, realistic clicking
// ============================================
class Humanizer {

    /**
     * @param {'slow'|'normal'|'fast'} profile - Speed profile
     */
    constructor(profile = 'normal') {
        this.profile = profile;
        this.profiles = {
            slow: {
                clickDelay: [800, 2000],
                typeDelay: [120, 280],
                moveDelay: [400, 800],
                thinkDelay: [1500, 4000],
                postActionDelay: [500, 1500]
            },
            normal: {
                clickDelay: [400, 1200],
                typeDelay: [60, 180],
                moveDelay: [250, 500],
                thinkDelay: [800, 2500],
                postActionDelay: [300, 900]
            },
            fast: {
                clickDelay: [150, 500],
                typeDelay: [30, 90],
                moveDelay: [100, 300],
                thinkDelay: [300, 1000],
                postActionDelay: [150, 500]
            }
        };

        BezierMouse.init();
    }

    get _p() {
        return this.profiles[this.profile];
    }

    /**
     * Async random delay between min and max ms.
     */
    async wait(min, max) {
        const delay = min + Math.random() * (max - min);
        return new Promise(r => setTimeout(r, delay));
    }

    /**
     * "Thinking" delay before answering.
     */
    async think() {
        const [min, max] = this._p.thinkDelay;
        await this.wait(min, max);
    }

    /**
     * Short delay after performing an action.
     */
    async afterAction() {
        const [min, max] = this._p.postActionDelay;
        await this.wait(min, max);
    }

    /**
     * Click an element with human-like mouse movement + delay.
     * @param {Element} element - Target element
     * @param {Object} options - Additional options
     */
    async clickElement(element, options = {}) {
        if (!element) throw new Error('[Humanizer] Cannot click null element');

        const target = DOMHelpers.getBoundingCenter(element);
        const current = BezierMouse.getCurrentPosition();

        // Move mouse to target along Bezier curve
        const [moveMin, moveMax] = this._p.moveDelay;
        const moveDuration = moveMin + Math.random() * (moveMax - moveMin);
        await BezierMouse.moveTo(current.x, current.y, target.x, target.y, moveDuration);

        // Small delay before click
        await this.wait(30, 120);

        // Add tiny random offset from center (humans don't click exactly center)
        const offsetX = (Math.random() - 0.5) * 6;
        const offsetY = (Math.random() - 0.5) * 6;
        const clickX = target.x + offsetX;
        const clickY = target.y + offsetY;

        // Dispatch full click sequence
        const eventInit = {
            clientX: clickX,
            clientY: clickY,
            bubbles: true,
            cancelable: true,
            view: window,
            button: 0,
            buttons: 1
        };

        element.dispatchEvent(new PointerEvent('pointerdown', eventInit));
        element.dispatchEvent(new MouseEvent('mousedown', eventInit));

        await this.wait(50, 150); // Hold duration

        element.dispatchEvent(new PointerEvent('pointerup', eventInit));
        element.dispatchEvent(new MouseEvent('mouseup', eventInit));
        element.dispatchEvent(new MouseEvent('click', eventInit));

        // Update tracked position
        BezierMouse._lastX = clickX;
        BezierMouse._lastY = clickY;

        // Post-click delay
        const [clickMin, clickMax] = this._p.clickDelay;
        await this.wait(clickMin / 3, clickMax / 3);
    }

    /**
     * Type text into an input/textarea with human-like keystroke timing.
     * @param {Element} element - Input element
     * @param {string} text - Text to type
     */
    async typeText(element, text) {
        if (!element) throw new Error('[Humanizer] Cannot type into null element');

        // Focus the element first
        element.focus();
        element.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
        await this.wait(100, 300);

        // Clear existing value
        element.value = '';
        element.dispatchEvent(new Event('input', { bubbles: true }));

        const [typeMin, typeMax] = this._p.typeDelay;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const keyCode = char.charCodeAt(0);

            // KeyDown
            element.dispatchEvent(new KeyboardEvent('keydown', {
                key: char, code: `Key${char.toUpperCase()}`,
                keyCode, which: keyCode,
                bubbles: true, cancelable: true
            }));

            // KeyPress (for printable chars)
            element.dispatchEvent(new KeyboardEvent('keypress', {
                key: char, code: `Key${char.toUpperCase()}`,
                keyCode, which: keyCode, charCode: keyCode,
                bubbles: true, cancelable: true
            }));

            // Update value character by character
            element.value += char;

            // Input event
            element.dispatchEvent(new InputEvent('input', {
                data: char, inputType: 'insertText',
                bubbles: true, cancelable: true
            }));

            // KeyUp
            element.dispatchEvent(new KeyboardEvent('keyup', {
                key: char, code: `Key${char.toUpperCase()}`,
                keyCode, which: keyCode,
                bubbles: true, cancelable: true
            }));

            // Random delay between keystrokes
            const delay = typeMin + Math.random() * (typeMax - typeMin);
            // Occasionally add a longer "thinking" pause mid-typing
            const extraPause = Math.random() < 0.1 ? Math.random() * 300 : 0;
            await this.wait(delay + extraPause, delay + extraPause + 1);
        }

        // Final change event
        element.dispatchEvent(new Event('change', { bubbles: true }));
    }

    /**
     * Submit by pressing Enter on the active element.
     * @param {Element} element - Element to send Enter to
     */
    async pressEnter(element) {
        await this.wait(100, 400);

        const enterEvent = {
            key: 'Enter', code: 'Enter',
            keyCode: 13, which: 13,
            bubbles: true, cancelable: true
        };

        element.dispatchEvent(new KeyboardEvent('keydown', enterEvent));
        element.dispatchEvent(new KeyboardEvent('keypress', enterEvent));
        await this.wait(50, 120);
        element.dispatchEvent(new KeyboardEvent('keyup', enterEvent));
    }

    /**
     * Simulate drag from one element to another.
     * @param {Element} source - Element to drag
     * @param {Element} target - Drop target element
     */
    async dragTo(source, target) {
        const srcCenter = DOMHelpers.getBoundingCenter(source);
        const tgtCenter = DOMHelpers.getBoundingCenter(target);
        const current = BezierMouse.getCurrentPosition();

        // Move to source
        await BezierMouse.moveTo(current.x, current.y, srcCenter.x, srcCenter.y, 200 + Math.random() * 200);
        await this.wait(80, 200);

        // Press down on source
        const downInit = {
            clientX: srcCenter.x, clientY: srcCenter.y,
            bubbles: true, cancelable: true, view: window, button: 0
        };
        source.dispatchEvent(new PointerEvent('pointerdown', downInit));
        source.dispatchEvent(new MouseEvent('mousedown', downInit));

        // Dispatch dragstart if HTML5 DnD
        try {
            source.dispatchEvent(new DragEvent('dragstart', {
                clientX: srcCenter.x, clientY: srcCenter.y,
                bubbles: true, cancelable: true,
                dataTransfer: new DataTransfer()
            }));
        } catch { /* DataTransfer may not be constructable in all browsers */ }

        await this.wait(100, 250);

        // Move along Bezier path to target
        const [moveMin, moveMax] = this._p.moveDelay;
        const moveDuration = (moveMin + Math.random() * (moveMax - moveMin)) * 2;
        const path = BezierMouse.generatePath(
            srcCenter.x, srcCenter.y, tgtCenter.x, tgtCenter.y,
            Math.floor(moveDuration / 16)
        );

        for (const point of path) {
            const el = document.elementFromPoint(point.x, point.y) || target;
            const moveInit = {
                clientX: point.x, clientY: point.y,
                bubbles: true, cancelable: true, view: window, button: 0
            };
            el.dispatchEvent(new PointerEvent('pointermove', moveInit));
            el.dispatchEvent(new MouseEvent('mousemove', moveInit));
            try {
                el.dispatchEvent(new DragEvent('dragover', {
                    clientX: point.x, clientY: point.y,
                    bubbles: true, cancelable: true,
                    dataTransfer: new DataTransfer()
                }));
            } catch { }
            await this.wait(12, 20);
        }

        // Release on target
        const upInit = {
            clientX: tgtCenter.x, clientY: tgtCenter.y,
            bubbles: true, cancelable: true, view: window, button: 0
        };

        try {
            target.dispatchEvent(new DragEvent('drop', {
                clientX: tgtCenter.x, clientY: tgtCenter.y,
                bubbles: true, cancelable: true,
                dataTransfer: new DataTransfer()
            }));
            source.dispatchEvent(new DragEvent('dragend', {
                clientX: tgtCenter.x, clientY: tgtCenter.y,
                bubbles: true, cancelable: true,
                dataTransfer: new DataTransfer()
            }));
        } catch { }

        target.dispatchEvent(new PointerEvent('pointerup', upInit));
        target.dispatchEvent(new MouseEvent('mouseup', upInit));
        target.dispatchEvent(new MouseEvent('click', upInit));

        BezierMouse._lastX = tgtCenter.x;
        BezierMouse._lastY = tgtCenter.y;

        await this.afterAction();
    }
}


// ── src/core/DOMWatcher.js ──────────────────────────────

// ============================================
// DOMWatcher — MutationObserver wrapper
// Detects DOM changes: new questions, level
// transitions, score updates, feedback messages.
// ============================================
class DOMWatcher {

    constructor() {
        this._observers = [];
        this._listeners = new Map();
        this._lastContentHash = '';
        this._watching = false;
    }

    /**
     * Register an event listener.
     * @param {'questionChanged'|'levelComplete'|'error'|'scoreUpdate'|'domChange'} event
     * @param {Function} callback
     */
    on(event, callback) {
        if (!this._listeners.has(event)) {
            this._listeners.set(event, []);
        }
        this._listeners.get(event).push(callback);
    }

    _emit(event, data = null) {
        const callbacks = this._listeners.get(event) || [];
        for (const cb of callbacks) {
            try { cb(data); } catch (e) {
                console.warn(`[DOMWatcher] Event handler error for '${event}':`, e);
            }
        }
    }

    /**
     * Start watching the DOM for changes.
     */
    start() {
        if (this._watching) return;
        this._watching = true;

        // --- Main content observer ---
        const contentObserver = new MutationObserver((mutations) => {
            this._handleMutations(mutations);
        });

        // Watch the entire body for child/subtree changes
        contentObserver.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
            attributeFilter: ['class', 'style', 'data-state', 'data-correct', 'disabled']
        });

        this._observers.push(contentObserver);

        // Initial content snapshot
        this._lastContentHash = this._getContentHash();

        console.log('[DOMWatcher] 🔍 Watching for DOM changes...');
    }

    /**
     * Stop all observers.
     */
    stop() {
        this._watching = false;
        for (const obs of this._observers) {
            obs.disconnect();
        }
        this._observers = [];
        console.log('[DOMWatcher] ⏹ Stopped watching.');
    }

    /**
     * Handle mutations from MutationObserver.
     */
    _handleMutations(mutations) {
        let hasSignificantChange = false;
        let hasClassChange = false;

        for (const mutation of mutations) {
            // Track added/removed nodes (question change)
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Check for feedback elements (correct/wrong indicators)
                        if (this._isFeedbackElement(node)) {
                            this._handleFeedback(node);
                        }
                        hasSignificantChange = true;
                    }
                }
            }

            // Track attribute changes
            if (mutation.type === 'attributes') {
                hasClassChange = true;
            }
        }

        if (hasSignificantChange) {
            // Debounce: check if actual content changed
            const newHash = this._getContentHash();
            if (newHash !== this._lastContentHash) {
                this._lastContentHash = newHash;
                this._emit('questionChanged');
                this._emit('domChange');
            }
        }

        if (hasClassChange) {
            this._emit('domChange');
        }
    }

    /**
     * Generate a simple hash of the current task content.
     */
    _getContentHash() {
        // Try multiple possible task area selectors
        const selectors = [
            '.board', '.task', '.question', '.exercise',
            '[class*="task"]', '[class*="question"]', '[class*="board"]',
            'main', '.content', '#app'
        ];
        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el) {
                return el.textContent.trim().substring(0, 200);
            }
        }
        return document.body.textContent.substring(0, 200);
    }

    /**
     * Check if a node is a feedback/result element.
     */
    _isFeedbackElement(node) {
        const text = (node.className || '') + ' ' + (node.id || '');
        return /correct|wrong|error|success|result|feedback|score/i.test(text);
    }

    /**
     * Handle feedback elements (correct/wrong answers).
     */
    _handleFeedback(node) {
        const text = (node.className || '') + ' ' + (node.textContent || '');
        if (/correct|success|right|správn/i.test(text)) {
            this._emit('scoreUpdate', { correct: true });
        } else if (/wrong|error|incorrect|špatn/i.test(text)) {
            this._emit('scoreUpdate', { correct: false });
            this._emit('error', { node, message: 'Wrong answer detected' });
        }
    }

    /**
     * Wait for a content change (new question to appear).
     * @param {number} timeout
     * @returns {Promise<void>}
     */
    waitForChange(timeout = 15000) {
        return new Promise((resolve, reject) => {
            const handler = () => {
                clearTimeout(timer);
                resolve();
            };
            this.on('questionChanged', handler);
            const timer = setTimeout(() => {
                // Remove handler
                const handlers = this._listeners.get('questionChanged') || [];
                const idx = handlers.indexOf(handler);
                if (idx >= 0) handlers.splice(idx, 1);
                reject(new Error('[DOMWatcher] Timeout waiting for content change'));
            }, timeout);
        });
    }
}


// ── src/core/StateManager.js ────────────────────────────

// ============================================
// StateManager — Score tracking, stuck detection
// ============================================
class StateManager {

    constructor() {
        this.state = {
            totalQuestions: 0,
            correct: 0,
            wrong: 0,
            streak: 0,
            lastActivityTime: Date.now(),
            isRunning: false,
            isPaused: false,
            currentModule: null,
            mode: 'auto', // 'auto' | 'manual'
            errors: []
        };

        this._stuckCheckInterval = null;
        this._stuckThreshold = 15000; // 15 seconds
        this._onStuck = null;
    }

    /**
     * Start the state manager with stuck detection.
     * @param {Function} onStuck - Callback when stuck detected
     */
    start(onStuck) {
        this.state.isRunning = true;
        this.state.lastActivityTime = Date.now();
        this._onStuck = onStuck;

        this._stuckCheckInterval = setInterval(() => {
            this._checkStuck();
        }, 3000);
    }

    stop() {
        this.state.isRunning = false;
        if (this._stuckCheckInterval) {
            clearInterval(this._stuckCheckInterval);
            this._stuckCheckInterval = null;
        }
    }

    /**
     * Record activity (resets stuck timer).
     */
    recordActivity() {
        this.state.lastActivityTime = Date.now();
    }

    /**
     * Record a correct answer.
     */
    recordCorrect() {
        this.state.totalQuestions++;
        this.state.correct++;
        this.state.streak++;
        this.state.lastActivityTime = Date.now();

        console.log(
            `%c[State] ✅ Correct! Score: ${this.state.correct}/${this.state.totalQuestions} | Streak: ${this.state.streak}`,
            'color: #4CAF50; font-weight: bold'
        );
    }

    /**
     * Record a wrong answer.
     */
    recordWrong() {
        this.state.totalQuestions++;
        this.state.wrong++;
        this.state.streak = 0;
        this.state.lastActivityTime = Date.now();

        console.log(
            `%c[State] ❌ Wrong! Score: ${this.state.correct}/${this.state.totalQuestions}`,
            'color: #f44336; font-weight: bold'
        );
    }

    /**
     * Set the current active module.
     */
    setModule(moduleName) {
        this.state.currentModule = moduleName;
    }

    /**
     * Check if solver is stuck.
     */
    _checkStuck() {
        if (!this.state.isRunning || this.state.isPaused) return;

        const elapsed = Date.now() - this.state.lastActivityTime;
        if (elapsed > this._stuckThreshold) {
            console.warn(
                `%c[State] ⚠️ Stuck detected! No activity for ${Math.round(elapsed / 1000)}s`,
                'color: #FF9800; font-weight: bold'
            );

            if (this._onStuck) {
                this._onStuck(elapsed);
            }
        }
    }

    /**
     * Switch to manual mode.
     */
    toManual() {
        this.state.mode = 'manual';
        console.log(
            '%c[State] 🔧 Switched to MANUAL mode. Solver paused.',
            'color: #FF9800; font-weight: bold'
        );
    }

    /**
     * Switch back to auto mode.
     */
    toAuto() {
        this.state.mode = 'auto';
        this.state.lastActivityTime = Date.now();
        console.log(
            '%c[State] 🤖 Switched to AUTO mode. Solver resumed.',
            'color: #2196F3; font-weight: bold'
        );
    }

    /**
     * Get summary stats.
     */
    getSummary() {
        const { correct, wrong, totalQuestions, streak } = this.state;
        const accuracy = totalQuestions > 0 ? Math.round((correct / totalQuestions) * 100) : 0;
        return { correct, wrong, totalQuestions, streak, accuracy, mode: this.state.mode };
    }

    /**
     * Log error for debugging.
     */
    logError(error, context = '') {
        this.state.errors.push({
            time: new Date().toISOString(),
            error: error.message || error,
            context
        });
        console.error(`[State] Error in ${context}:`, error);
    }
}


// ── src/core/GameRouter.js ──────────────────────────────

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


// ── src/modules/BaseModule.js ───────────────────────────

// ============================================
// BaseModule — Abstract base class for all
// game-solving modules.
// ============================================
class BaseModule {

    /**
     * @param {Humanizer} humanizer - Shared humanizer instance
     * @param {StateManager} stateManager - Shared state manager
     */
    constructor(humanizer, stateManager) {
        if (new.target === BaseModule) {
            throw new Error('BaseModule is abstract and cannot be instantiated directly');
        }
        this.humanizer = humanizer;
        this.stateManager = stateManager;
        this.name = 'BaseModule';
        this._active = false;
    }

    /**
     * Check if this module can handle the current DOM state.
     * Must be overridden by subclasses.
     * @returns {boolean}
     */
    canHandle() {
        throw new Error('canHandle() must be implemented by subclass');
    }

    /**
     * Solve the current task/question.
     * Must be overridden by subclasses.
     * @returns {Promise<boolean>} true if solved successfully
     */
    async solve() {
        throw new Error('solve() must be implemented by subclass');
    }

    /**
     * Get module-specific state.
     * @returns {Object}
     */
    getState() {
        return { name: this.name, active: this._active };
    }

    /**
     * Activate this module.
     */
    activate() {
        this._active = true;
        this.stateManager.setModule(this.name);
        console.log(
            `%c[${this.name}] 🚀 Module activated`,
            'color: #2196F3; font-weight: bold'
        );
    }

    /**
     * Deactivate this module.
     */
    deactivate() {
        this._active = false;
        console.log(`[${this.name}] Module deactivated`);
    }

    /**
     * Helper: extract question/task text from the page.
     * Tries multiple selectors common across umimeto.org.
     */
    _getQuestionText() {
        const selectors = [
            '.task-text', '.question-text', '.task h2', '.task h3',
            '.question', '.exercise-text', '.board .text',
            '.board h2', '.board h3', '.task p',
            '[class*="question"]', '[class*="task-text"]',
            '[class*="zadani"]', '[class*="priklad"]'
        ];

        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el) {
                const text = DOMHelpers.getTextContent(el);
                if (text.length > 0) return text;
            }
        }

        // Fallback: look for prominent text in the board/main area
        const board = document.querySelector('.board, main, .content, #app');
        if (board) {
            const headers = board.querySelectorAll('h1, h2, h3, h4, p, .text');
            for (const h of headers) {
                const text = DOMHelpers.getTextContent(h);
                if (text.length > 2 && text.length < 500) return text;
            }
        }

        return '';
    }

    /**
     * Helper: wait for the next question to load.
     * @param {number} timeout
     */
    async _waitForNextQuestion(timeout = 5000) {
        await this.humanizer.wait(500, 1500);
        try {
            await DOMHelpers.waitForElement('.task, .question, .board, .exercise', timeout);
        } catch {
            // Timeout is okay — question might already be there
        }
    }

    /**
     * Helper: detect if the current question shows a result/feedback.
     */
    _hasFeedback() {
        const selectors = [
            '.feedback', '.result', '[class*="feedback"]',
            '[class*="result"]', '.correct', '.wrong',
            '[class*="correct"]', '[class*="wrong"]',
            '[class*="success"]', '[class*="error"]'
        ];
        for (const sel of selectors) {
            if (document.querySelector(sel)) return true;
        }
        return false;
    }

    /**
     * Helper: click a "next" or "continue" button if present.
     */
    async _clickNext() {
        const nextSelectors = [
            'button.next', 'button[class*="next"]',
            '.next-button', '.continue-button',
            'button[class*="continue"]', 'button[class*="dalsi"]',
            '.btn-next', '#next-btn',
            'button.btn-primary'
        ];

        for (const sel of nextSelectors) {
            const btn = document.querySelector(sel);
            if (btn && DOMHelpers.isVisible(btn)) {
                await this.humanizer.clickElement(btn);
                return true;
            }
        }

        // Try buttons containing "Další" or "Pokračovat" text
        const allButtons = DOMHelpers.getVisibleElements('button, a.btn, [role="button"]');
        for (const btn of allButtons) {
            const text = DOMHelpers.getTextContent(btn).toLowerCase();
            if (text.includes('další') || text.includes('pokračovat') || text.includes('next') || text.includes('znovu')) {
                await this.humanizer.clickElement(btn);
                return true;
            }
        }

        return false;
    }
}


// ── src/modules/TextInputModule.js ──────────────────────

// ============================================
// TextInputModule — Module A
// Solves "Psaná odpověď" (Written Answer) tasks
// Extracts question, computes answer, types it in.
// ============================================
class TextInputModule extends BaseModule {

    constructor(humanizer, stateManager) {
        super(humanizer, stateManager);
        this.name = 'TextInputModule';
        this._inputSelectors = [
            'input.answer', 'input[name="answer"]',
            'input[type="text"][class*="answer"]',
            'input[type="number"][class*="answer"]',
            '.task input[type="text"]',
            '.task input[type="number"]',
            '.exercise input[type="text"]',
            'input.form-control',
            '#answer-input',
            'input[data-answer]',
            '.board input[type="text"]',
            '.board input[type="number"]',
            'input:not([type="hidden"]):not([type="submit"])'
        ];
        this._submitSelectors = [
            'button[type="submit"]', 'input[type="submit"]',
            'button.submit', 'button[class*="submit"]',
            'button[class*="check"]', 'button[class*="answer"]',
            '.submit-button', '#submit-btn',
            'button.btn-primary',
            'button[class*="zkontrolovat"]',
            'button[class*="odeslat"]',
            'button[class*="potvrdit"]'
        ];
    }

    canHandle() {
        for (const sel of this._inputSelectors) {
            try {
                const inputs = DOMHelpers.getVisibleElements(sel);
                if (inputs.length > 0) return true;
            } catch { }
        }
        return false;
    }

    async solve() {
        try {
            // 1. Find the input field
            const input = this._findInput();
            if (!input) {
                console.warn(`[${this.name}] Could not find input field`);
                return false;
            }

            // 2. Extract the question text
            const questionText = this._getQuestionText();
            if (!questionText) {
                console.warn(`[${this.name}] Could not extract question text`);
                return false;
            }

            console.log(`[${this.name}] 📝 Question: "${questionText}"`);

            // 3. Solve the math
            const answer = this._computeAnswer(questionText, input);
            if (answer === null) {
                console.warn(`[${this.name}] Could not compute answer for: "${questionText}"`);
                return false;
            }

            console.log(`[${this.name}] 💡 Answer: ${answer}`);

            // 4. Human-like thinking delay
            await this.humanizer.think();

            // 5. Type the answer
            await this.humanizer.typeText(input, answer.toString());

            // 6. Submit
            await this._submit(input);

            this.stateManager.recordActivity();
            return true;

        } catch (error) {
            this.stateManager.logError(error, this.name);
            return false;
        }
    }

    /**
     * Find the answer input field.
     */
    _findInput() {
        for (const sel of this._inputSelectors) {
            try {
                const inputs = DOMHelpers.getVisibleElements(sel);
                for (const input of inputs) {
                    // Prefer inputs that are empty and editable
                    if (!input.disabled && !input.readOnly) {
                        return input;
                    }
                }
            } catch { }
        }
        return null;
    }

    /**
     * Compute the answer from question text.
     */
    _computeAnswer(questionText, input) {
        // Check if the input has a data attribute with expected answer format
        const placeholder = input.placeholder || '';

        // Try to extract math expression from question
        let answer = MathSolver.solve(questionText);

        if (answer !== null) return answer;

        // Try extracting just the mathematical part
        // Pattern: "Kolik je 5 + 3?" or "Vypočítej: 5 + 3"
        const mathPatterns = [
            /(?:kolik je|vypočítej|spočítej|výsledek|=\s*\?)\s*[:\s]*(.+?)[\?\s]*$/i,
            /(\d[\d\s+\-*/×÷().^,]+\d)\s*=?\s*\??$/,
            /(\d+\s*[+\-*/×÷]\s*\d+(?:\s*[+\-*/×÷]\s*\d+)*)/,
            /=\s*\?\s*$/
        ];

        for (const pattern of mathPatterns) {
            const match = questionText.match(pattern);
            if (match) {
                answer = MathSolver.solve(match[1] || match[0]);
                if (answer !== null) return answer;
            }
        }

        // Last resort: try the entire text as an expression
        // Remove common Czech words
        const stripped = questionText
            .replace(/kolik\s+je/gi, '')
            .replace(/vypočítej/gi, '')
            .replace(/spočítej/gi, '')
            .replace(/výsledek/gi, '')
            .replace(/doplň/gi, '')
            .replace(/\?/g, '')
            .trim();

        return MathSolver.solve(stripped);
    }

    /**
     * Submit the answer (button click or Enter key).
     */
    async _submit(input) {
        await this.humanizer.wait(200, 600);

        // Try clicking a submit button first
        for (const sel of this._submitSelectors) {
            const btn = document.querySelector(sel);
            if (btn && DOMHelpers.isVisible(btn)) {
                await this.humanizer.clickElement(btn);
                return;
            }
        }

        // Try finding button by text content
        const buttons = DOMHelpers.getVisibleElements('button');
        for (const btn of buttons) {
            const text = DOMHelpers.getTextContent(btn).toLowerCase();
            if (text.includes('ok') || text.includes('zkontrol') || text.includes('odpověd') ||
                text.includes('odeslat') || text.includes('potvrdit') || text.includes('submit')) {
                await this.humanizer.clickElement(btn);
                return;
            }
        }

        // Fallback: press Enter
        await this.humanizer.pressEnter(input);
    }

    getState() {
        return {
            ...super.getState(),
            inputFound: !!this._findInput()
        };
    }
}


// ── src/modules/ChoiceModule.js ─────────────────────────

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


// ── src/modules/PexesoModule.js ─────────────────────────

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


// ── src/modules/DragDropModule.js ───────────────────────

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


// ── src/core/UmimeSolver.js ─────────────────────────────

// ============================================
// UmimeSolver — Main Orchestrator
// Initializes all sub-systems, detects games,
// activates modules, and runs the solving loop.
// ============================================
class UmimeSolver {

    /**
     * @param {Object} config
     * @param {'slow'|'normal'|'fast'} config.speed - Speed profile
     * @param {boolean} config.autoStart - Auto-start on load
     * @param {string[]} config.enabledModules - Which modules to enable
     */
    constructor(config = {}) {
        this.config = {
            speed: config.speed || 'normal',
            autoStart: config.autoStart !== false,
            enabledModules: config.enabledModules || ['textInput', 'choice', 'pexeso', 'dragDrop'],
            maxRetries: config.maxRetries || 3,
            loopDelay: config.loopDelay || [1500, 3500], // [min, max] ms between actions
            ...config
        };

        // Core systems
        this.humanizer = new Humanizer(this.config.speed);
        this.stateManager = new StateManager();
        this.domWatcher = new DOMWatcher();

        // Game modules
        this.modules = {};
        this._initModules();

        // State
        this._running = false;
        this._loopHandle = null;
        this._retryCount = 0;
        this._currentModule = null;

        // Banner
        this._printBanner();

        // Auto-start if configured
        if (this.config.autoStart) {
            this.start();
        }
    }

    /**
     * Initialize all game modules.
     */
    _initModules() {
        const moduleMap = {
            textInput: TextInputModule,
            choice: ChoiceModule,
            pexeso: PexesoModule,
            dragDrop: DragDropModule
        };

        for (const [key, ModuleClass] of Object.entries(moduleMap)) {
            if (this.config.enabledModules.includes(key)) {
                this.modules[key] = new ModuleClass(this.humanizer, this.stateManager);
            }
        }

        console.log(
            `%c[UmimeSolver] 📦 Loaded modules: ${Object.keys(this.modules).join(', ')}`,
            'color: #9C27B0'
        );
    }

    // ── Lifecycle ─────────────────────────────────

    /**
     * Start the solver.
     */
    start() {
        if (this._running) {
            console.warn('[UmimeSolver] Already running!');
            return;
        }

        this._running = true;
        this.stateManager.start((elapsed) => this._onStuck(elapsed));
        this.domWatcher.start();

        // Listen for DOM changes
        this.domWatcher.on('questionChanged', () => {
            this._retryCount = 0;
            this.stateManager.recordActivity();
        });

        this.domWatcher.on('scoreUpdate', (data) => {
            if (data.correct) {
                this.stateManager.recordCorrect();
            } else {
                this.stateManager.recordWrong();
            }
        });

        console.log(
            `%c[UmimeSolver] ▶️ Started! Speed: ${this.config.speed}`,
            'color: #4CAF50; font-weight: bold; font-size: 14px'
        );

        // Start the main loop
        this._runLoop();
    }

    /**
     * Stop the solver.
     */
    stop() {
        this._running = false;
        this.stateManager.stop();
        this.domWatcher.stop();

        if (this._loopHandle) {
            clearTimeout(this._loopHandle);
            this._loopHandle = null;
        }

        // Deactivate current module
        if (this._currentModule) {
            this._currentModule.deactivate();
            this._currentModule = null;
        }

        const summary = this.stateManager.getSummary();
        console.log(
            `%c[UmimeSolver] ⏹ Stopped. Final score: ${summary.correct}/${summary.totalQuestions} (${summary.accuracy}%)`,
            'color: #f44336; font-weight: bold; font-size: 14px'
        );
    }

    /**
     * Pause the solver.
     */
    pause() {
        this.stateManager.state.isPaused = true;
        console.log('%c[UmimeSolver] ⏸ Paused', 'color: #FF9800; font-weight: bold');
    }

    /**
     * Resume the solver.
     */
    resume() {
        this.stateManager.state.isPaused = false;
        this.stateManager.recordActivity();
        console.log('%c[UmimeSolver] ▶️ Resumed', 'color: #4CAF50; font-weight: bold');
    }

    /**
     * Get current status.
     */
    status() {
        const summary = this.stateManager.getSummary();
        const moduleStates = {};
        for (const [key, mod] of Object.entries(this.modules)) {
            moduleStates[key] = mod.getState();
        }
        return {
            running: this._running,
            paused: this.stateManager.state.isPaused,
            ...summary,
            currentModule: this._currentModule?.name || 'none',
            modules: moduleStates
        };
    }

    // ── Main Loop ─────────────────────────────────

    async _runLoop() {
        if (!this._running) return;
        if (this.stateManager.state.isPaused) {
            this._loopHandle = setTimeout(() => this._runLoop(), 1000);
            return;
        }

        try {
            // 1. Identify game type
            const gameType = GameRouter.identifyGameType();

            if (gameType) {
                // 2. Find and activate the matching module
                const module = this.modules[gameType.type];

                if (module) {
                    // Switch module if needed
                    if (this._currentModule !== module) {
                        if (this._currentModule) this._currentModule.deactivate();
                        module.activate();
                        this._currentModule = module;
                    }

                    // 3. Check if module can handle current state
                    if (module.canHandle()) {
                        const success = await module.solve();

                        if (success) {
                            this._retryCount = 0;
                            // Wait for potential feedback / next question transition
                            await this.humanizer.afterAction();

                            // Try clicking "next" if available
                            await module._clickNext();
                        } else {
                            this._retryCount++;
                            console.warn(`[UmimeSolver] Solve failed (retry ${this._retryCount}/${this.config.maxRetries})`);
                        }
                    } else {
                        // Module can't handle current state — might be a transition
                        await this.humanizer.wait(500, 1000);
                    }
                } else {
                    console.warn(`[UmimeSolver] No module available for game type: ${gameType.type}`);
                }
            } else {
                // No game detected — wait and retry
                await this.humanizer.wait(1000, 2000);
            }

        } catch (error) {
            this.stateManager.logError(error, 'mainLoop');
            this._retryCount++;
        }

        // Check retry limit
        if (this._retryCount >= this.config.maxRetries) {
            console.warn(
                `%c[UmimeSolver] ⚠️ Max retries reached. Waiting before next attempt...`,
                'color: #FF9800'
            );
            await this.humanizer.wait(3000, 5000);
            this._retryCount = 0;
        }

        // Schedule next loop iteration
        const [loopMin, loopMax] = this.config.loopDelay;
        const delay = loopMin + Math.random() * (loopMax - loopMin);
        this._loopHandle = setTimeout(() => this._runLoop(), delay);
    }

    // ── Recovery ──────────────────────────────────

    _onStuck(elapsed) {
        console.warn(
            `%c[UmimeSolver] 🔄 Stuck recovery triggered (${Math.round(elapsed / 1000)}s idle)`,
            'color: #FF9800; font-weight: bold'
        );

        // Strategy 1: Try clicking "next" or "continue"
        if (this._currentModule) {
            this._currentModule._clickNext().then(clicked => {
                if (clicked) {
                    console.log('[UmimeSolver] Recovery: clicked next button');
                    this.stateManager.recordActivity();
                } else {
                    // Strategy 2: Switch to manual mode after repeated stucks
                    if (this.stateManager.state.errors.length >= 5) {
                        this.stateManager.toManual();
                        this.pause();
                    }
                }
            });
        }

        this.stateManager.recordActivity(); // Reset timer
    }

    // ── Banner ────────────────────────────────────

    _printBanner() {
        console.log(`
%c╔══════════════════════════════════════════╗
║          🎓 UmimeTo Solver v1.0         ║
║       github.com/darqsideee/miskavec    ║
╠══════════════════════════════════════════╣
║  Speed: ${this.config.speed.padEnd(8)}                        ║
║  Modules: ${Object.keys(this.modules).length}                            ║
║                                          ║
║  Commands:                               ║
║    solver.start()   - Start solving      ║
║    solver.stop()    - Stop solving       ║
║    solver.pause()   - Pause              ║
║    solver.resume()  - Resume             ║
║    solver.status()  - Check status       ║
╚══════════════════════════════════════════╝`,
            'color: #2196F3; font-family: monospace; font-size: 12px'
        );
    }
}

// ── Global Entry Point ──────────────────────────
// Expose to window for console access
(function () {
    // Default config (can be overridden via window.UMIME_CONFIG before loading)
    const config = window.UMIME_CONFIG || {
        speed: 'normal',
        autoStart: true,
        enabledModules: ['textInput', 'choice', 'pexeso', 'dragDrop']
    };

    // Create global solver instance
    window.solver = new UmimeSolver(config);

    // Convenience aliases
    window.umime = window.solver;
})();


})();
