import { describe, expect, mock, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

// Real-render regression coverage for the admin teacher-schedule row after
// its migration to the shared scheduleTableLayout.tsx/scheduleCellContent.tsx
// components -- this is the admin view structurally closest to the worker's
// own read-only grid (both combine one worker's classes + activities across
// a week), so it is the primary parity target. useDeleteScheduleAssignment/
// useDeleteScheduleTeacher are the only TanStack Query hooks this
// component's subtree calls -- mocked at that exact boundary, no
// QueryClientProvider needed.

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

interface RenderRowOptions {
  schedulesScholar?: unknown[];
  scheduleTeacher?: unknown[];
  totalHours?: number;
}

function renderRow({
  schedulesScholar = [],
  scheduleTeacher = [],
  totalHours = 20,
}: RenderRowOptions = {}) {
  return renderToStaticMarkup(
    <table>
      <tbody>
        <RowTeacherSchedule
          schedulesScholar={schedulesScholar as never}
          scheduleTeacher={scheduleTeacher as never}
          totalHours={totalHours}
          workers={[]}
          semesterId="3"
          workerId="12"
          workerLabel="Ana López"
          allScheduleTeachers={scheduleTeacher as never}
          allScheduleAssignments={schedulesScholar as never}
        />
      </tbody>
    </table>
  );
}

describe("RowTeacherSchedule (admin) -- no regression after the shared-layout migration", () => {
  test("both recess rows render, spanning all five weekday columns", () => {
    const html = renderRow();
    expect(html.match(/RECESO/g) ?? []).toHaveLength(2);
    expect(html.match(/colSpan="5"/g) ?? []).toHaveLength(2);
  });

  test("every regular block time label renders, in chronological order", () => {
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

  test("totalHours !== 40: no reserved-slot badge, Monday 07:00 offers the normal add control", () => {
    const html = renderRow({ totalHours: 20 });
    expect(html).not.toContain("Homenaje / Tutoría");
    expect(html).toContain("Agregar actividad");
  });

  test("totalHours === 40: the Monday 07:00 cell shows the 'Homenaje / Tutoría' reserved badge", () => {
    const html = renderRow({ totalHours: 40 });
    expect(html).toContain("Homenaje / Tutoría");
  });

  test("an empty cell offers both the scholar 'Agregar' affordance (via the sibling component) and the activity add control", () => {
    const html = renderRow();
    expect(html).toContain("Agregar actividad");
    expect(html).toContain("<button");
  });

  describe("17:00-19:00 extracurricular row -- conditional, matching the worker grid's own rule", () => {
    test("absent when nothing starts at 17:00", () => {
      const html = renderRow();
      expect(html).not.toContain("17:00 - 19:00");
      expect(html).not.toContain("HORARIO EXTRACURRICULAR");
    });

    test("present, with its divider, when a scholar assignment starts at 17:00", () => {
      const html = renderRow({
        schedulesScholar: [
          {
            id: 900,
            weekday: "Lunes",
            start_time: "17:00:00",
            end_time: "19:00:00",
            subjects: { name: "Robótica" },
            groups: { year_of_admission: 2024, letter: "A", degrees: { code: "PREE" } },
          },
        ],
      });
      expect(html).toContain("17:00 - 19:00");
      expect(html).toContain("HORARIO EXTRACURRICULAR");
      expect(html).toContain("Clase — ROBÓTICA");
    });

    test("present when a teacher activity starts at 17:00", () => {
      const html = renderRow({
        scheduleTeacher: [
          { id: 901, weekday: "Martes", start_time: "17:00:00", end_time: "19:00:00", activity: "Club de lectura" },
        ],
      });
      expect(html).toContain("17:00 - 19:00");
      expect(html).toContain("HORARIO EXTRACURRICULAR");
      expect(html).toContain("Actividad — Club de lectura");
    });
  });

  test("a class entry shows the shared content component's discreet label plus edit/delete controls", () => {
    const html = renderRow({
      schedulesScholar: [
        {
          id: 100,
          weekday: "Martes",
          start_time: "09:20:00",
          end_time: "11:10:00",
          subjects: { name: "Matemáticas" },
          groups: { year_of_admission: 2024, letter: "A", degrees: { code: "PREE" } },
        },
      ],
    });
    expect(html).toContain("Clase — MATEMÁTICAS");
    expect(html).toContain("Editar horario");
    expect(html).toContain("Eliminar horario");
  });

  test("an activity entry shows the shared content component's discreet label, no secondary line", () => {
    const html = renderRow({
      scheduleTeacher: [
        { id: 200, weekday: "Miercoles", start_time: "11:10:00", end_time: "13:00:00", activity: "Guardia" },
      ],
    });
    expect(html).toContain("Actividad — Guardia");
    expect(html).toContain("Editar actividad");
    expect(html).toContain("Eliminar actividad");
  });

  test("multiple scholar assignments in the same weekday/block both render", () => {
    const html = renderRow({
      schedulesScholar: [
        {
          id: 301,
          weekday: "Jueves",
          start_time: "13:10:00",
          end_time: "15:00:00",
          subjects: { name: "Física" },
          groups: { year_of_admission: 2024, letter: "A", degrees: { code: "PREE" } },
        },
        {
          id: 302,
          weekday: "Jueves",
          start_time: "13:10:00",
          end_time: "15:00:00",
          subjects: { name: "Química" },
          groups: { year_of_admission: 2023, letter: "B", degrees: { code: "PREE" } },
        },
      ],
    });
    expect(html).toContain("Clase — FÍSICA");
    expect(html).toContain("Clase — QUÍMICA");
  });
});
