/**
 * What Enter and F2 step into, and what the Tab walk within a row steps
 * through. Deliberately the plain list rather than a full tabbable audit: a
 * cell holds a control or it doesn't, and anything exotic enough to fool this
 * is exotic enough to handle its own keys.
 *
 * A hidden input is excluded: Mantine's Select keeps its value in one, and it
 * is focusable enough to swallow a Tab step meant for the next control.
 */
export const FOCUSABLE_IN_CELL = [
  "button:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  "a[href]",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Puts the caret inside a mounted editor host.
 *
 * `editor-input` is the part a built-in publishes for exactly this, and the
 * first focusable descendant is the fallback that makes a custom editor work
 * without publishing anything. The grid places the caret this way rather than
 * leaving it to the editor, because an editor is free not to bother - and then
 * the cell opened with the caret still outside it.
 */
export function focusEditorContent(editor: HTMLElement): void {
  const target =
    editor.querySelector<HTMLElement>('[data-dg-part="editor-input"]') ??
    editor.querySelector<HTMLElement>(FOCUSABLE_IN_CELL);
  target?.focus();
}
