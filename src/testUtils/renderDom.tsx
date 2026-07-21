import "./domTestSetup";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { ReactElement } from "react";

// Minimal, dependency-free (no @testing-library/react) real-DOM render
// harness: mounts into a container attached to document.body (so
// document.activeElement / focus / Tab order all behave like a real
// page), wrapped in act() so state updates triggered during
// render/effects are flushed before the caller inspects the DOM.
export interface DomRender {
  container: HTMLElement;
  root: Root;
  rerender: (next: ReactElement) => void;
  unmount: () => void;
}

export function renderDom(element: ReactElement): DomRender {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(element);
  });

  return {
    container,
    root,
    rerender(next: ReactElement) {
      act(() => {
        root.render(next);
      });
    },
    unmount() {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

// Runs an async state-updating action (e.g. a mutation that resolves a
// mocked network promise) inside act(), then flushes microtasks so React
// has committed every resulting state update before the caller inspects
// the DOM.
export async function actAsync(fn: () => Promise<void> | void) {
  await act(async () => {
    await fn();
  });
}

export function fireKeyDown(
  target: EventTarget,
  key: string,
  options: Partial<KeyboardEventInit> = {}
) {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...options,
  });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

export function fireClick(target: EventTarget) {
  const event = new MouseEvent("click", { bubbles: true, cancelable: true });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

export function fireMouseDown(target: EventTarget) {
  const event = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

// A microtask/short-macrotask flush -- enough for a chain of already-
// resolved (mocked) promises plus their .then() handlers to settle and
// for React to process the resulting state updates, without relying on a
// fixed sleep duration.
export async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

// Sets a controlled text/search <input>'s value via the native property
// setter (never a plain `Object.defineProperty` override, which would
// shadow React's own value-tracking on the element) and fires a real
// "input" event, wrapped in act() so the resulting state update (a
// controlled input's onChange) is flushed before the caller inspects the
// DOM -- an unwrapped dispatchEvent can trigger a React state update that
// commits outside of act(), producing the "not wrapped in act(...)" warning.
export function fireInputValue(input: HTMLInputElement, value: string) {
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value"
  )?.set;
  nativeInputValueSetter?.call(input, value);
  const event = new Event("input", { bubbles: true, cancelable: true });
  act(() => {
    input.dispatchEvent(event);
  });
  return event;
}

// Same as fireInputValue, for a controlled <select> -- sets the value via
// the native property setter (not a plain override, for the same reason)
// and fires a real "change" event (what <select> actually emits on
// selection, unlike text inputs which emit "input"), wrapped in act().
export function fireSelectValue(select: HTMLSelectElement, value: string) {
  const nativeSelectValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLSelectElement.prototype,
    "value"
  )?.set;
  nativeSelectValueSetter?.call(select, value);
  const event = new Event("change", { bubbles: true, cancelable: true });
  act(() => {
    select.dispatchEvent(event);
  });
  return event;
}

// Browsers never let a script assign to a real <input type="file">'s
// `.files` directly (it's read-only for security reasons), so this is the
// standard test-only technique: override the property descriptor on this
// one input instance, then dispatch a genuine "change" event so the
// component's real onChange handler runs exactly as it would for a real
// user selection.
export function selectFiles(input: HTMLInputElement, files: File[]) {
  Object.defineProperty(input, "files", {
    value: files,
    configurable: true,
  });
  const event = new Event("change", { bubbles: true, cancelable: true });
  act(() => {
    input.dispatchEvent(event);
  });
}
