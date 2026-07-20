import { describe, expect, mock, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

// Proof that MySchedule.tsx renders the real MyScheduleView tree again
// (this file's own audit finding: MySchedule.tsx previously rendered a
// static "Mi horario" placeholder heading -- see
// openspec/changes/complete-worker-schedule -- so a text-content
// assertion alone couldn't distinguish "real view" from "placeholder",
// since MyScheduleView's own "ready"/"empty-schedule" states also render
// that same heading). Driving MyScheduleView to its "no-semesters" state
// instead renders text ("Aún no hay semestres registrados.") the
// placeholder never produced under any state, and that only
// MyScheduleView's own resolveMyScheduleViewState logic can produce --
// proving the real component executed, not a hand-authored approximation.
//
// Same renderToStaticMarkup pattern already established in
// workerRouteBranchRender.test.tsx (no window/document, no jsdom/
// testing-library dependency). The three hooks MyScheduleView.tsx calls
// directly are mocked at that exact boundary -- not their own internal
// useUser/useProfile/supabase dependencies -- since none of those three
// hooks are wrapped in a QueryClientProvider here, and mocking one level
// deeper avoids needing one.

mock.module("../features/semesters/useSemesters", () => ({
  useSemesters: () => ({ isLoading: false, semesters: [], error: null }),
}));

mock.module("../features/schedules/useMyScheduleAssignments", () => ({
  useMyScheduleAssignments: () => ({
    isLoading: false,
    scheduleAssignments: [],
    error: null,
  }),
}));

mock.module("../features/schedules/useMyScheduleTeacherActivities", () => ({
  useMyScheduleTeacherActivities: () => ({
    isLoading: false,
    scheduleTeacherActivities: [],
    error: null,
  }),
}));

const { default: MySchedule } = await import("./MySchedule");

describe("MySchedule (page)", () => {
  test("renders the real MyScheduleView tree, not the old static placeholder", () => {
    const markup = renderToStaticMarkup(<MySchedule />);

    expect(markup).toContain("Aún no hay semestres registrados.");
  });

  test("no longer renders as a bare 'Mi horario' heading with nothing else", () => {
    const markup = renderToStaticMarkup(<MySchedule />);

    // The retired placeholder was exactly `<h1>Mi horario</h1>` and nothing
    // more. MyScheduleView's "no-semesters" state renders neither the
    // heading nor the semester selector at all (both only appear once a
    // semester is selectable) -- a real regression back to the placeholder
    // would fail the first assertion above, and a partial regression that
    // still rendered the old heading markup would fail this one.
    expect(markup).not.toContain("Mi horario");
  });
});
