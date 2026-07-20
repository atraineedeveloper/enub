import { describe, expect, mock, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

// Smoke-level regression coverage for the two admin "Show*" containers
// after migrating their Table/TableHeader to the shared ScheduleTable/
// ScheduleTableHeader (scheduleTableLayout.tsx). Exercises the default
// (nothing selected) render only -- PDF export components
// (ScheduleGroupPDF/ScheduleTeacherPDF) render conditionally on a
// selection existing, so this smoke render never reaches them, keeping
// this file focused on proving the table container/header/selector still
// mount correctly. Row-level content/action regression is covered in
// depth by RowScholarSchedule.test.tsx/RowTeacherSchedule.test.tsx.

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

const { default: ShowScholarSchedule } = await import("./ShowScholarSchedule");
const { default: ShowTeacherSchedule } = await import("./ShowTeacherSchedule");

describe("ShowScholarSchedule (admin) -- no regression after the shared-layout migration", () => {
  test("renders the group selector and the shared table header without crashing", () => {
    const html = renderToStaticMarkup(
      <ShowScholarSchedule scheduleAssignments={[]} groups={[]} semesterId="3" />
    );
    expect(html).toContain("Seleccione grupo escolar");
    expect(html).toContain("<table");
    expect(html).toContain("Lunes");
    expect(html).toContain("Viernes");
  });

  test("nothing selected: no row content, no crash from the empty RowScholarSchedule branch", () => {
    const html = renderToStaticMarkup(
      <ShowScholarSchedule scheduleAssignments={[]} groups={[]} semesterId="3" />
    );
    expect(html).not.toContain("Homenaje / Tutoria");
  });
});

describe("ShowTeacherSchedule (admin) -- no regression after the shared-layout migration", () => {
  test("renders the worker selector and the shared table header without crashing", () => {
    const html = renderToStaticMarkup(
      <ShowTeacherSchedule workers={[]} scheduleTeachers={[]} scheduleAssignments={[]} semesterId="3" />
    );
    expect(html).toContain("Seleccione trabajador");
    expect(html).toContain("<table");
    expect(html).toContain("Lunes");
    expect(html).toContain("Viernes");
  });

  test("nothing selected: no row content, no crash from the empty RowTeacherSchedule branch", () => {
    const html = renderToStaticMarkup(
      <ShowTeacherSchedule workers={[]} scheduleTeachers={[]} scheduleAssignments={[]} semesterId="3" />
    );
    expect(html).not.toContain("RECESO");
  });
});
