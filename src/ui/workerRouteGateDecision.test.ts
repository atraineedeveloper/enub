import { describe, expect, test } from "bun:test";
import { resolveWorkerRouteGateDecision } from "./workerRouteGateDecision";

describe("resolveWorkerRouteGateDecision", () => {
  test("loading while role/profile linkage is still resolving", () => {
    expect(
      resolveWorkerRouteGateDecision({ isLoading: true, role: null, workerId: null })
    ).toEqual({ type: "loading" });
  });

  test("a valid, linked worker is allowed through", () => {
    expect(
      resolveWorkerRouteGateDecision({ isLoading: false, role: "worker", workerId: 7 })
    ).toEqual({ type: "allow" });
  });

  test("admin is redirected to /dashboard, never allowed", () => {
    expect(
      resolveWorkerRouteGateDecision({ isLoading: false, role: "admin", workerId: null })
    ).toEqual({ type: "redirect", to: "/dashboard" });
  });

  test("staff is redirected to /dashboard, never allowed", () => {
    expect(
      resolveWorkerRouteGateDecision({ isLoading: false, role: "staff", workerId: null })
    ).toEqual({ type: "redirect", to: "/dashboard" });
  });

  test("a missing profiles row (role null) is redirected to /pending-access", () => {
    expect(
      resolveWorkerRouteGateDecision({ isLoading: false, role: null, workerId: null })
    ).toEqual({ type: "redirect", to: "/pending-access" });
  });

  test("an unrecognized role is redirected to /pending-access", () => {
    expect(
      resolveWorkerRouteGateDecision({ isLoading: false, role: "manager", workerId: null })
    ).toEqual({ type: "redirect", to: "/pending-access" });
  });

  describe("worker role with an invalid worker_id -> /pending-access, never allowed", () => {
    test.each([
      ["missing (null)", null],
      ["zero", 0],
      ["negative", -3],
      ["non-integer", 2.5],
      ["NaN", NaN],
      ["Infinity", Infinity],
    ])("%s workerId", (_label, workerId) => {
      expect(
        resolveWorkerRouteGateDecision({
          isLoading: false,
          role: "worker",
          workerId: workerId as number | null,
        })
      ).toEqual({ type: "redirect", to: "/pending-access" });
    });
  });

  test("admin/staff short-circuits before workerId is ever consulted, even with an otherwise valid one", () => {
    expect(
      resolveWorkerRouteGateDecision({ isLoading: false, role: "admin", workerId: 7 })
    ).toEqual({ type: "redirect", to: "/dashboard" });
  });
});

// The former text-structural, source-order regression check that lived
// here (grepping App.tsx's raw source for route declaration order) has
// been superseded by a real render-level proof:
// workerRouteBranchRender.test.tsx renders App.tsx's own
// buildWorkerRouteBranch/buildPendingAccessBranch construction
// (workerRouteBranch.tsx) through a real MemoryRouter via
// react-dom/server's renderToStaticMarkup, and asserts what actually does
// or does not appear in the rendered output for each authorization state
// -- including that /pending-access renders its own header but never
// WorkerNav or worker-layout content. That is now the primary proof of
// the route/layout composition; the pure decision-table tests above
// remain the primary proof of the redirect DESTINATIONS themselves.
