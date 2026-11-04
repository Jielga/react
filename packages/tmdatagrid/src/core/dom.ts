/**
 * DOM checks that survive a second realm.
 *
 * The grid can be rendered through a portal into a window opened with
 * `window.open`. That window is a separate JavaScript realm: its nodes and
 * events are instances of *its* `Node`, `Element`, `HTMLInputElement` and
 * `MouseEvent`, not the opener's. A plain `x instanceof HTMLInputElement`
 * is therefore false for an input sitting in the grid's own window, and the
 * check silently takes the wrong branch.
 *
 * Every helper here answers the same question either by duck-typing, or by
 * taking the constructor from the realm the value itself came from.
 */

/**
 * The window a node lives in - the realm to take its constructors from.
 *
 * A document made by `createHTMLDocument` has no window of its own, so the
 * global one is the fallback.
 */
export function windowOf(node: Node): Window & typeof globalThis {
  return node.ownerDocument?.defaultView ?? window;
}

/**
 * Whether a value is a DOM node.
 *
 * Duck-typed on `nodeType`, because `instanceof Node` is false for a node
 * from another realm.
 */
export function isNode(value: unknown): value is Node {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Node).nodeType === "number"
  );
}

/**
 * Whether a value is an element - a node whose `nodeType` is 1
 * (`Node.ELEMENT_NODE`), read as a number so no realm's constant is needed.
 */
export function isElement(value: unknown): value is Element {
  return isNode(value) && value.nodeType === 1;
}

/** Whether a value is an HTML element, asked of its own realm's constructor. */
export function isHTMLElement(value: unknown): value is HTMLElement {
  return isElement(value) && value instanceof windowOf(value).HTMLElement;
}

/** Whether a value is an `<input>`, asked of its own realm's constructor. */
export function isInputElement(value: unknown): value is HTMLInputElement {
  return isElement(value) && value instanceof windowOf(value).HTMLInputElement;
}

/** Whether a value is a `<button>`, asked of its own realm's constructor. */
export function isButtonElement(value: unknown): value is HTMLButtonElement {
  return isElement(value) && value instanceof windowOf(value).HTMLButtonElement;
}

/**
 * Whether an event is a mouse event, asked of the constructor in the event's
 * own window.
 *
 * A browser-dispatched event carries that window in `view`; one built by hand
 * may not, and its target still knows the window.
 */
export function isMouseEvent(event: Event): event is MouseEvent {
  const view =
    (event as UIEvent).view ??
    (isNode(event.target) ? windowOf(event.target) : window);
  return event instanceof (view as Window & typeof globalThis).MouseEvent;
}
