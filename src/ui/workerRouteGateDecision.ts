import { isValidWorkerId } from "../features/authentication/workerLinkValidation";

// Pure decision logic for WorkerRouteGate, extracted so every branch is
// directly unit-testable without a DOM/render environment (the project has
// no DOM testing library -- see AGENTS.md's current limitation). The
// component itself (WorkerRouteGate.tsx) only translates this decision
// into <SpinnerFullPage />/<Navigate />/<Outlet />.
export type WorkerRouteGateDecision =
  | { type: "loading" }
  | { type: "redirect"; to: "/dashboard" | "/pending-access" }
  | { type: "allow" };

export function resolveWorkerRouteGateDecision(input: {
  isLoading: boolean;
  role: string | null;
  workerId: number | null;
}): WorkerRouteGateDecision {
  if (input.isLoading) return { type: "loading" };

  if (input.role === "staff" || input.role === "admin") {
    return { type: "redirect", to: "/dashboard" };
  }

  if (!(input.role === "worker" && isValidWorkerId(input.workerId))) {
    return { type: "redirect", to: "/pending-access" };
  }

  return { type: "allow" };
}
