import { describe, expect, test } from "bun:test";
import { useState } from "react";
import { fireClick, fireKeyDown, renderDom } from "./renderDom";

// A self-test of the render harness itself: real DOM, real click events,
// real keydown events, real state updates -- proves the foundation the
// Modal/drawer DOM suites are built on actually works before relying on
// it for those larger, behavior-critical tests.

function Counter() {
  const [count, setCount] = useState(0);
  return (
    <button type="button" onClick={() => setCount((value) => value + 1)}>
      count: {count}
    </button>
  );
}

function KeyListener() {
  const [lastKey, setLastKey] = useState("none");
  return (
    <div
      tabIndex={0}
      onKeyDown={(event) => setLastKey(event.key)}
      data-testid="key-target"
    >
      last key: {lastKey}
    </div>
  );
}

describe("renderDom harness", () => {
  test("mounts into a real document.body-attached container", () => {
    const { container, unmount } = renderDom(<Counter />);
    expect(document.body.contains(container)).toBe(true);
    unmount();
    expect(document.body.contains(container)).toBe(false);
  });

  test("fireClick dispatches a real click event that React's onClick receives", () => {
    const { container, unmount } = renderDom(<Counter />);
    const button = container.querySelector("button")!;
    expect(button.textContent).toBe("count: 0");

    fireClick(button);
    expect(button.textContent).toBe("count: 1");

    fireClick(button);
    expect(button.textContent).toBe("count: 2");
    unmount();
  });

  test("fireKeyDown dispatches a real keydown event that React's onKeyDown receives", () => {
    const { container, unmount } = renderDom(<KeyListener />);
    const target = container.querySelector('[data-testid="key-target"]')!;

    fireKeyDown(target, "Escape");
    expect(target.textContent).toBe("last key: Escape");

    fireKeyDown(target, "Tab");
    expect(target.textContent).toBe("last key: Tab");
    unmount();
  });

  test("real focus management works (document.activeElement reflects .focus())", () => {
    const { container, unmount } = renderDom(<Counter />);
    const button = container.querySelector("button")!;
    button.focus();
    expect(document.activeElement).toBe(button);
    unmount();
  });
});
