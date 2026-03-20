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
