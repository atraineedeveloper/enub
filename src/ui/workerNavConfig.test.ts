import { describe, expect, test } from "bun:test";
import { WORKER_NAV_ITEMS } from "./workerNavConfig";

describe("WORKER_NAV_ITEMS (worker self-service navigation ordering)", () => {
  test("has exactly three entries", () => {
    expect(WORKER_NAV_ITEMS).toHaveLength(3);
  });

  test("entries are in the exact required order: Mis documentos, Mi horario, Mi información", () => {
    expect(WORKER_NAV_ITEMS.map((item) => item.label)).toEqual([
      "Mis documentos",
      "Mi horario",
      "Mi información",
    ]);
  });

  test("routes match the exact required order", () => {
    expect(WORKER_NAV_ITEMS.map((item) => item.to)).toEqual([
      "/my-documents",
      "/my-schedule",
      "/my-profile",
    ]);
  });
});
