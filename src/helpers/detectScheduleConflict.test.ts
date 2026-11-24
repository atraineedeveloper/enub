import { describe, expect, test } from "bun:test";
import { hasWorkerScheduleConflict } from "./detectScheduleConflict";

const entry = { id: 7, worker_id: 3, weekday: "Lunes", start_time: "07:00:00", end_time: "08:50:00" };
describe("cross-table schedule conflict", () => {
  test("rejects an overlap with the other table when creating", () => {
    expect(hasWorkerScheduleConflict([], [entry], entry)).toBe(true);
  });
  test("does not exclude an unrelated record with the same ID", () => {
    expect(hasWorkerScheduleConflict([entry], [entry], entry, 7)).toBe(true);
  });
  test("allows editing the original record without a conflict", () => {
    expect(hasWorkerScheduleConflict([entry], [], entry, 7)).toBe(false);
  });
  test("allows adjacent blocks and different workers", () => {
    expect(hasWorkerScheduleConflict([], [{ ...entry, start_time: "08:50:00", end_time: "09:20:00" }], entry)).toBe(false);
    expect(hasWorkerScheduleConflict([], [{ ...entry, worker_id: 4 }], entry)).toBe(false);
  });
});
