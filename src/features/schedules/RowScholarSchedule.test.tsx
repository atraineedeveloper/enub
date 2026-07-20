import { describe, expect, mock, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

// Real-render regression coverage for the admin scholar-schedule row after
// its migration to the shared scheduleTableLayout.tsx/scheduleCellContent.tsx
// components (audit request: confirm no regression in the two
// administrative schedules). useDeleteScheduleAssignment is the only
// TanStack Query hook this component's subtree calls (via
// HourScheduleSubject.tsx) -- mocked at that exact boundary so this file
// needs no QueryClientProvider, matching the pattern already established
// in workerRouteBranchRender.test.tsx.

mock.module("./useDeleteScheduleAssignment", () => ({
  useDeleteScheduleAssignment: () => ({
    isDeleting: false,
    deleteScheduleAssignment: () => {},
  }),
}));

const { default: RowScholarSchedule } = await import("./RowScholarSchedule");

function renderRow(schedules: unknown[] = []) {
  return renderToStaticMarkup(
    <table>
      <tbody>
        <RowScholarSchedule
          schedules={schedules as never}
          semesterId="3"
          groupId="9"
          groupLabel='1° "A" - PREE'
        />
      </tbody>
    </table>
  );
}

describe("RowScholarSchedule (admin) -- no regression after the shared-layout migration", () => {
  test("renders the fixed 'Homenaje / Tutoria' Monday slot -- never a lookup for that cell", () => {
    const html = renderRow();
    expect(html).toContain("Homenaje / Tutoria");
  });

  test("both recess rows render, spanning all five weekday columns", () => {
    const html = renderRow();
    expect(html.match(/RECESO/g) ?? []).toHaveLength(2);
    expect(html.match(/colSpan="5"/g) ?? []).toHaveLength(2);
  });

  test("every block time label renders, in chronological order", () => {
    const html = renderRow();
    const labelsInOrder = [
      "7:00 - 8:50",
      "8:50 - 9:20",
      "9:20 - 11:10",
      "11:10 - 13:00",
      "13:00 - 13:10",
      "13:10 - 15:00",
    ];
    let searchFrom = 0;
    for (const label of labelsInOrder) {
      const index = html.indexOf(label, searchFrom);
      expect(index).toBeGreaterThanOrEqual(searchFrom);
      searchFrom = index + label.length;
    }
  });

  test("an empty (non-Monday) cell still offers the 'Agregar horario' add control -- admin controls remain functional", () => {
    const html = renderRow();
    expect(html).toContain("Agregar horario");
    expect(html).toContain("<button");
  });

  test("an occupied cell shows the shared class content plus edit/delete controls", () => {
    const schedule = {
      id: 501,
      weekday: "Martes",
      start_time: "07:00:00",
      end_time: "08:50:00",
      subjects: { name: "Matemáticas" },
      workers: { name: "ana lópez" },
    };
    const html = renderRow([schedule]);
    expect(html).toContain("Clase — MATEMÁTICAS");
    expect(html).toContain("Ana López"); // capitalizeName-formatted teacher name
    expect(html).toContain("Editar horario");
    expect(html).toContain("Eliminar horario");
  });

  test("this row never renders the 17:00-19:00 block or its divider -- scholar schedules have no extracurricular row", () => {
    const html = renderRow();
    expect(html).not.toContain("17:00 - 19:00");
    expect(html).not.toContain("HORARIO EXTRACURRICULAR");
  });
});
