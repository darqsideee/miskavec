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

        // Add tiny random offset from center
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
            buttons: 1,
            pointerId: 1,
            pointerType: 'mouse',
            isPrimary: true,
            width: 1, height: 1,
            pressure: 0.5
        };

        element.dispatchEvent(new PointerEvent('pointerdown', eventInit));
        element.dispatchEvent(new MouseEvent('mousedown', eventInit));

        await this.wait(50, 150);

        element.dispatchEvent(new PointerEvent('pointerup', { ...eventInit, pressure: 0 }));
        element.dispatchEvent(new MouseEvent('mouseup', eventInit));
        element.dispatchEvent(new MouseEvent('click', eventInit));

        BezierMouse._lastX = clickX;
        BezierMouse._lastY = clickY;

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

        element.focus();
        element.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
        await this.wait(100, 300);

        element.value = '';
        element.dispatchEvent(new Event('input', { bubbles: true }));

        const [typeMin, typeMax] = this._p.typeDelay;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const keyCode = char.charCodeAt(0);

            element.dispatchEvent(new KeyboardEvent('keydown', {
                key: char, code: `Key${char.toUpperCase()}`,
                keyCode, which: keyCode,
                bubbles: true, cancelable: true
            }));

            element.dispatchEvent(new KeyboardEvent('keypress', {
                key: char, code: `Key${char.toUpperCase()}`,
                keyCode, which: keyCode, charCode: keyCode,
                bubbles: true, cancelable: true
            }));

            element.value += char;

            element.dispatchEvent(new InputEvent('input', {
                data: char, inputType: 'insertText',
                bubbles: true, cancelable: true
            }));

            element.dispatchEvent(new KeyboardEvent('keyup', {
                key: char, code: `Key${char.toUpperCase()}`,
                keyCode, which: keyCode,
                bubbles: true, cancelable: true
            }));

            const delay = typeMin + Math.random() * (typeMax - typeMin);
            const extraPause = Math.random() < 0.1 ? Math.random() * 300 : 0;
            await this.wait(delay + extraPause, delay + extraPause + 1);
        }

        element.dispatchEvent(new Event('change', { bubbles: true }));
    }

    /**
     * Submit by pressing Enter on the active element.
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
     * Fixed for umimeto.org: uses pointerId, monkeypatches
     * setPointerCapture, dispatches moves on the SOURCE element
     * (since pointer capture sends events to capturing element).
     *
     * @param {Element} source - Element to drag
     * @param {Element} target - Drop target element
     */
    async dragTo(source, target) {
        const srcCenter = DOMHelpers.getBoundingCenter(source);
        const tgtCenter = DOMHelpers.getBoundingCenter(target);
        const current = BezierMouse.getCurrentPosition();
        const POINTER_ID = 1;

        // ── Monkeypatch setPointerCapture / releasePointerCapture ─────
        // The site's code calls setPointerCapture which fails on synthetic
        // events. We temporarily replace it with a no-op.
        const origSetCapture = Element.prototype.setPointerCapture;
        const origReleaseCapture = Element.prototype.releasePointerCapture;
        const origHasCapture = Element.prototype.hasPointerCapture;

        Element.prototype.setPointerCapture = function () { /* no-op */ };
        Element.prototype.releasePointerCapture = function () { /* no-op */ };
        Element.prototype.hasPointerCapture = function () { return true; };

        try {
            // Move mouse to source element
            await BezierMouse.moveTo(current.x, current.y, srcCenter.x, srcCenter.y, 150 + Math.random() * 150);
            await this.wait(50, 150);

            // ── Pointer down on source ─────────────────
            const downInit = {
                clientX: srcCenter.x,
                clientY: srcCenter.y,
                screenX: srcCenter.x,
                screenY: srcCenter.y,
                pageX: srcCenter.x + window.scrollX,
                pageY: srcCenter.y + window.scrollY,
                bubbles: true,
                cancelable: true,
                view: window,
                button: 0,
                buttons: 1,
                pointerId: POINTER_ID,
                pointerType: 'mouse',
                isPrimary: true,
                width: 1,
                height: 1,
                pressure: 0.5
            };

            source.dispatchEvent(new PointerEvent('pointerdown', downInit));
            source.dispatchEvent(new MouseEvent('mousedown', downInit));

            await this.wait(80, 200);

            // ── Move along Bezier path ─────────────────
            // CRITICAL: After pointer capture, the SITE expects pointermove
            // events on the SOURCE element (the captured element), not on
            // whatever is under the cursor.
            const [moveMin, moveMax] = this._p.moveDelay;
            const moveDuration = (moveMin + Math.random() * (moveMax - moveMin)) * 1.5;
            const steps = Math.max(15, Math.floor(moveDuration / 16));
            const path = BezierMouse.generatePath(
                srcCenter.x, srcCenter.y,
                tgtCenter.x, tgtCenter.y,
                steps
            );

            for (const point of path) {
                const moveInit = {
                    clientX: point.x,
                    clientY: point.y,
                    screenX: point.x,
                    screenY: point.y,
                    pageX: point.x + window.scrollX,
                    pageY: point.y + window.scrollY,
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    button: 0,
                    buttons: 1,
                    pointerId: POINTER_ID,
                    pointerType: 'mouse',
                    isPrimary: true,
                    width: 1,
                    height: 1,
                    pressure: 0.5,
                    movementX: 1,
                    movementY: 1
                };

                // Dispatch on SOURCE (pointer capture target)
                source.dispatchEvent(new PointerEvent('pointermove', moveInit));
                source.dispatchEvent(new MouseEvent('mousemove', moveInit));
                await this.wait(10, 18);
            }

            await this.wait(30, 80);

            // ── Pointer up over target zone ─────────────
            const upInit = {
                clientX: tgtCenter.x,
                clientY: tgtCenter.y,
                screenX: tgtCenter.x,
                screenY: tgtCenter.y,
                pageX: tgtCenter.x + window.scrollX,
                pageY: tgtCenter.y + window.scrollY,
                bubbles: true,
                cancelable: true,
                view: window,
                button: 0,
                buttons: 0,
                pointerId: POINTER_ID,
                pointerType: 'mouse',
                isPrimary: true,
                width: 1,
                height: 1,
                pressure: 0
            };

            // Dispatch pointerup on SOURCE (the captured element)
            source.dispatchEvent(new PointerEvent('pointerup', upInit));
            source.dispatchEvent(new MouseEvent('mouseup', upInit));

            BezierMouse._lastX = tgtCenter.x;
            BezierMouse._lastY = tgtCenter.y;

        } finally {
            // ── Restore original methods ───────────────
            Element.prototype.setPointerCapture = origSetCapture;
            Element.prototype.releasePointerCapture = origReleaseCapture;
            Element.prototype.hasPointerCapture = origHasCapture;
        }

        await this.afterAction();
    }
}
