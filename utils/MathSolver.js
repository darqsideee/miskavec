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
