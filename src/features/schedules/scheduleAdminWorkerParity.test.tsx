import { describe, expect, mock, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import WorkerScheduleGrid from "./WorkerScheduleGrid";
import type { WorkerScheduleEntry } from "./workerScheduleEntry";

// Direct structural-equivalence proof between the admin "Horario del
// Maestro" row (RowTeacherSchedule.tsx) and the worker's read-only grid
// (WorkerScheduleGrid.tsx) -- both now import their table shape from
// scheduleTableLayout.tsx and their cell content from
// scheduleCellContent.tsx, so equivalent fixture data must render an
// equivalent structural signature (same recess count/colspan, same block
// label sequence, same conditional extracurricular row, same "Clase —"/
// "Actividad —" content format). This is the direct, behavioral proof of
// "one real shared source" the visual audit asked for -- not an assertion
// about import statements, but about what actually renders.

mock.module("./useDeleteScheduleAssignment", () => ({
  useDeleteScheduleAssignment: () => ({
    isDeleting: false,
    deleteScheduleAssignment: () => {},
  }),
}));

mock.module("./useDeleteScheduleTeacher", () => ({
  useDeleteScheduleTeacher: () => ({
    isDeleting: false,
    deleteScheduleTeachers: () => {},
  }),
}));

const { default: RowTeacherSchedule } = await import("./RowTeacherSchedule");

function renderAdminTeacherRow(options: {
  schedulesScholar?: unknown[];
  scheduleTeacher?: unknown[];
}) {
  return renderToStaticMarkup(
    <table>
      <tbody>
        <RowTeacherSchedule
          schedulesScholar={(options.schedulesScholar ?? []) as never}
          scheduleTeacher={(options.scheduleTeacher ?? []) as never}
          totalHours={20}
          workers={[]}
          semesterId="3"
          workerId="12"
          workerLabel="Ana López"
          allScheduleTeachers={(options.scheduleTeacher ?? []) as never}
          allScheduleAssignments={(options.schedulesScholar ?? []) as never}
        />
      </tbody>
    </table>
  );
}

function renderWorkerGrid(entries: WorkerScheduleEntry[]) {
  return renderToStaticMarkup(<WorkerScheduleGrid entries={entries} />);
}

const BLOCK_LABELS = [
  "7:00 - 8:50",
  "8:50 - 9:20",
  "9:20 - 11:10",
  "11:10 - 13:00",
  "13:00 - 13:10",
  "13:10 - 15:00",
];

describe("Admin (Horario del Maestro) and worker grid render the identical structural signature", () => {
  test("both show exactly two RECESO rows, each spanning 5 columns", () => {
    const adminHtml = renderAdminTeacherRow({});
    const workerHtml = renderWorkerGrid([]);

    for (const html of [adminHtml, workerHtml]) {
      expect(html.match(/RECESO/g) ?? []).toHaveLength(2);
      expect(html.match(/colSpan="5"/g) ?? []).toHaveLength(2);
    }
  });

  test("both show the same 6 block labels in the same chronological order when nothing runs at 17:00", () => {
    for (const html of [renderAdminTeacherRow({}), renderWorkerGrid([])]) {
      let searchFrom = 0;
      for (const label of BLOCK_LABELS) {
        const index = html.indexOf(label, searchFrom);
        expect(index).toBeGreaterThanOrEqual(searchFrom);
        searchFrom = index + label.length;
      }
      expect(html).not.toContain("17:00 - 19:00");
      expect(html).not.toContain("HORARIO EXTRACURRICULAR");
    }
  });

  test("both add the 17:00-19:00 row and its divider under the identical condition (an entry starting exactly at 17:00)", () => {
    const adminHtml = renderAdminTeacherRow({
      scheduleTeacher: [
        { id: 1, weekday: "Lunes", start_time: "17:00:00", end_time: "19:00:00", activity: "Club" },
      ],
    });
    const workerHtml = renderWorkerGrid([
      {
        kind: "activity",
        id: "activity-1",
        weekday: "Lunes",
        startTime: "17:00:00",
        endTime: "19:00:00",
        activity: "Club",
      },
    ]);

    for (const html of [adminHtml, workerHtml]) {
      expect(html).toContain("17:00 - 19:00");
      expect(html).toContain("HORARIO EXTRACURRICULAR");
      expect(html).toContain("Actividad — Club");
    }
  });

  test("both render an equivalent class entry with the identical 'Clase — SUBJECT' content format", () => {
    const adminHtml = renderAdminTeacherRow({
      schedulesScholar: [
        {
          id: 1,
          weekday: "Lunes",
          start_time: "07:00:00",
          end_time: "08:50:00",
          subjects: { name: "Matemáticas" },
          groups: { year_of_admission: 2024, letter: "A", degrees: { code: "PREE" } },
        },
      ],
    });
    const workerHtml = renderWorkerGrid([
      {
        kind: "class",
        id: "assignment-1",
        weekday: "Lunes",
        startTime: "07:00:00",
        endTime: "08:50:00",
        subject: "Matemáticas",
        group: '1° "A" - PREE',
      },
    ]);

    expect(adminHtml).toContain("Clase — MATEMÁTICAS");
    expect(workerHtml).toContain("Clase — MATEMÁTICAS");
  });
});
