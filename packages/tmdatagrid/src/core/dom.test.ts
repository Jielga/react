import { describe, expect, it } from "vitest";
import {
  isButtonElement,
  isElement,
  isHTMLElement,
  isInputElement,
  isMouseEvent,
  isNode,
  windowOf,
} from "./dom";

/**
 * A second realm, standing in for the window a grid is portalled into: its
 * nodes and events are instances of its own constructors, not this one's.
 */
const frame = document.createElement("iframe");
document.body.append(frame);
const otherWindow = frame.contentWindow as Window & typeof globalThis;
otherWindow.document.body.innerHTML = "<input><button>";
const otherInput = otherWindow.document.querySelector("input")!;

describe("the premise", () => {
  it("fails a plain instanceof for a node from another realm", () => {
    expect(otherInput instanceof HTMLInputElement).toBe(false);
  });
});

describe("windowOf", () => {
  it("returns the node's own window", () => {
    expect(windowOf(otherInput)).toBe(otherWindow);
    expect(windowOf(document.createElement("input"))).toBe(window);
  });

  it("falls back to the global window for a document with none", () => {
    const detached = document.implementation.createHTMLDocument();
    expect(windowOf(detached.createElement("input"))).toBe(window);
  });
});

describe("the element checks", () => {
  it("recognise a node from another realm", () => {
    expect(isNode(otherInput)).toBe(true);
    expect(isElement(otherInput)).toBe(true);
    expect(isHTMLElement(otherInput)).toBe(true);
    expect(isInputElement(otherInput)).toBe(true);
  });

  it("still tell one element apart from another", () => {
    expect(isButtonElement(otherInput)).toBe(false);
    expect(isButtonElement(otherWindow.document.querySelector("button")!)).toBe(
      true,
    );
    expect(isInputElement(otherWindow.document.querySelector("button")!)).toBe(
      false,
    );
  });

  it("recognise a node from this realm", () => {
    const input = document.createElement("input");
    expect(isNode(input)).toBe(true);
    expect(isElement(input)).toBe(true);
    expect(isHTMLElement(input)).toBe(true);
    expect(isInputElement(input)).toBe(true);
    expect(isButtonElement(input)).toBe(false);
  });

  it("say no to what is not a node", () => {
    for (const value of [null, undefined, {}, "input"]) {
      expect(isNode(value)).toBe(false);
      expect(isElement(value)).toBe(false);
      expect(isHTMLElement(value)).toBe(false);
      expect(isInputElement(value)).toBe(false);
      expect(isButtonElement(value)).toBe(false);
    }
  });

  it("say no to a node that is not an element", () => {
    expect(isNode(otherWindow.document.createTextNode("x"))).toBe(true);
    expect(isElement(otherWindow.document.createTextNode("x"))).toBe(false);
  });
});

describe("isMouseEvent", () => {
  it("recognises a mouse event from another realm", () => {
    const event = new otherWindow.MouseEvent("click", { view: otherWindow });
    expect(event instanceof MouseEvent).toBe(false);
    expect(isMouseEvent(event)).toBe(true);
  });

  it("falls back to the target's window for an event without a view", () => {
    // A hand-built event carries no `view`, and a target only during dispatch.
    const event = new otherWindow.MouseEvent("click");
    expect((event as UIEvent).view).toBe(null);
    let seen: boolean | undefined;
    otherInput.addEventListener("click", () => {
      seen = isMouseEvent(event);
    });
    otherInput.dispatchEvent(event);
    expect(seen).toBe(true);
  });

  it("rejects a keyboard event from another realm", () => {
    const event = new otherWindow.KeyboardEvent("keydown", {
      view: otherWindow,
    });
    expect(isMouseEvent(event)).toBe(false);
  });

  it("recognises a mouse event from this realm", () => {
    expect(isMouseEvent(new MouseEvent("click"))).toBe(true);
    expect(isMouseEvent(new KeyboardEvent("keydown"))).toBe(false);
  });
});
