import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import WorkerScheduleGrid from "./WorkerScheduleGrid";
import { WORKER_SCHEDULE_DAY_BLOCKS, formatSchoolDayBlockLabel } from "./schoolDayBlocks";
import type { WorkerScheduleEntry } from "./workerScheduleEntry";

// Real render proof (react-dom/server's renderToStaticMarkup -- no DOM
// needed, none added as a dependency, established pattern) that the
// desktop grid's recess rows are wired correctly: no query/auth
// dependency exists on this component, so no mocking is required at all
// -- WorkerScheduleGrid takes only an `entries` prop.

const classEntry = (overrides: Partial<WorkerScheduleEntry> = {}): WorkerScheduleEntry =>
  ({
    kind: "class",
    id: "assignment-1",
    weekday: "Lunes",
    startTime: "07:00:00",
    endTime: "08:50:00",
    subject: "Matemáticas",
    group: "1A",
    ...overrides,
  }) as WorkerScheduleEntry;

describe("WorkerScheduleGrid -- recess rows (real render)", () => {
  test("both recess rows render with the exact RECESO label", () => {
    const html = renderToStaticMarkup(<WorkerScheduleGrid entries={[]} />);
    const recessMatches = html.match(/RECESO/g) ?? [];
    expect(recessMatches).toHaveLength(2);
  });

  test("desktop recess cell spans all five weekday columns", () => {
    const html = renderToStaticMarkup(<WorkerScheduleGrid entries={[]} />);
    const colspanMatches = html.match(/colSpan="5"/g) ?? [];
    expect(colspanMatches).toHaveLength(2);
  });

  test("both recess row headers show the exact expected time labels", () => {
    const html = renderToStaticMarkup(<WorkerScheduleGrid entries={[]} />);
    expect(html).toContain("8:50 - 9:20");
    expect(html).toContain("13:00 - 13:10");
  });

  test("exact chronological row order: every row header appears in the expected sequence", () => {
    const html = renderToStaticMarkup(<WorkerScheduleGrid entries={[]} />);
    const expectedLabelsInOrder = WORKER_SCHEDULE_DAY_BLOCKS.map((block) =>
      formatSchoolDayBlockLabel(block.startTime, block.endTime)
    );

    let searchFrom = 0;
    for (const label of expectedLabelsInOrder) {
      const index = html.indexOf(label, searchFrom);
      expect(index).toBeGreaterThanOrEqual(searchFrom);
      searchFrom = index + label.length;
    }
  });

  test("recess rendering is independent of `entries` -- identical RECESO/colspan counts whether entries are empty or populated", () => {
    const emptyHtml = renderToStaticMarkup(<WorkerScheduleGrid entries={[]} />);
    const populatedHtml = renderToStaticMarkup(
      <WorkerScheduleGrid entries={[classEntry()]} />
    );

    expect(populatedHtml.match(/RECESO/g) ?? []).toHaveLength(
      (emptyHtml.match(/RECESO/g) ?? []).length
    );
    expect(populatedHtml.match(/colSpan="5"/g) ?? []).toHaveLength(
      (emptyHtml.match(/colSpan="5"/g) ?? []).length
    );
    // The known entry's own content only appears in the populated render.
    expect(emptyHtml).not.toContain("Matemáticas");
    expect(populatedHtml).toContain("Matemáticas");
  });

  test("no class/activity cell renders inside a recess row -- an entry whose time exactly matches a recess period is not placed anywhere in the grid", () => {
    // No row in WORKER_SCHEDULE_DAY_BLOCKS has kind "schedule" with these
    // times (they belong to the first recess period), so this entry can
    // never be selected by selectCellEntries for any row, recess or
    // otherwise -- it must not appear anywhere in the rendered grid.
    const recessTimedEntry = classEntry({
      id: "assignment-recess-timed",
      startTime: "08:50:00",
      endTime: "09:20:00",
      subject: "SHOULD-NOT-RENDER-ANYWHERE",
    });

    const html = renderToStaticMarkup(<WorkerScheduleGrid entries={[recessTimedEntry]} />);
    expect(html).not.toContain("SHOULD-NOT-RENDER-ANYWHERE");
  });

  test("a normal canonical entry still renders in its own schedule cell, not swallowed by the recess-row change", () => {
    const html = renderToStaticMarkup(<WorkerScheduleGrid entries={[classEntry()]} />);
    expect(html).toContain("Matemáticas");
    expect(html).toContain("1A");
  });
});
