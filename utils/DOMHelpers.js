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
