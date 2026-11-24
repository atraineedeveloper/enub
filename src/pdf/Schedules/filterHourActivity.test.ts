import { describe, expect, test } from "bun:test";
import filterHourActivity from "./filterHourActivity";
import type { ScheduleTeacher } from "../../features/schedules/useScheduleTeachers";
const activity = (id: number, name: string | null): ScheduleTeacher => ({
  id, activity: name, weekday: "Lunes", start_time: "07:00:00", end_time: "08:50:00", created_at: "", worker_id: 1, semester_id: 1, workers: null, semesters: null,
});
describe("PDF activity text", () => {
  test("includes every matching record", () => {
    expect(filterHourActivity([activity(1, "Tutoría"), activity(2, "Asesoría")], "Lunes", "07:00:00")).toBe("Tutoría\n\nAsesoría");
  });
  test("handles null and empty blocks", () => {
    expect(filterHourActivity([activity(1, null)], "Lunes", "07:00:00")).toBe("Actividad sin nombre");
    expect(filterHourActivity([], "Lunes", "07:00:00")).toBe("");
  });
});
