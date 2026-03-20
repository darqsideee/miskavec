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
