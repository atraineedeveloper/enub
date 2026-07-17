import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import WorkerScheduleAgenda from "./WorkerScheduleAgenda";
import type { WorkerScheduleEntry } from "./workerScheduleEntry";

// Real render proof (react-dom/server's renderToStaticMarkup -- no DOM,
// no mocking needed; WorkerScheduleAgenda takes only an `entries` prop).

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

describe("WorkerScheduleAgenda -- recess separators (real render)", () => {
  test("a day with entries shows RECESO with the exact time labels", () => {
    const html = renderToStaticMarkup(
      <WorkerScheduleAgenda entries={[classEntry()]} />
    );
    expect(html).toContain("RECESO");
    expect(html).toContain("8:50 - 9:20");
    expect(html).toContain("13:00 - 13:10");
  });

  test("mobile ordering places recess chronologically between surrounding entries", () => {
    const before = classEntry({
      id: "assignment-before",
      startTime: "07:00:00",
      endTime: "08:50:00",
      subject: "ANTES",
    });
    const between = classEntry({
      id: "assignment-between",
      startTime: "11:10:00",
      endTime: "13:00:00",
      subject: "ENTRE",
    });
    const after = classEntry({
      id: "assignment-after",
      startTime: "13:10:00",
      endTime: "15:00:00",
      subject: "DESPUES",
    });

    const html = renderToStaticMarkup(
      <WorkerScheduleAgenda entries={[after, before, between]} />
    );

    const indices = {
      before: html.indexOf("ANTES"),
      firstRecess: html.indexOf("8:50 - 9:20"),
      between: html.indexOf("ENTRE"),
      secondRecess: html.indexOf("13:00 - 13:10"),
      after: html.indexOf("DESPUES"),
    };

    expect(indices.before).toBeGreaterThan(-1);
    expect(indices.firstRecess).toBeGreaterThan(indices.before);
    expect(indices.between).toBeGreaterThan(indices.firstRecess);
    expect(indices.secondRecess).toBeGreaterThan(indices.between);
    expect(indices.after).toBeGreaterThan(indices.secondRecess);
  });

  test("no duplicate recess separators within a day -- RECESO appears exactly twice for one displayed day", () => {
    const html = renderToStaticMarkup(
      <WorkerScheduleAgenda
        entries={[classEntry(), classEntry({ id: "assignment-2", startTime: "09:20:00", endTime: "11:10:00" })]}
      />
    );
    expect(html.match(/RECESO/g) ?? []).toHaveLength(2);
  });

  test("does not create an otherwise-empty day solely to display recess -- a weekday with zero entries shows no RECESO for that day", () => {
    // Only Lunes has an entry; Martes/Miercoles/Jueves/Viernes have none.
    // groupWorkerScheduleByWeekday always produces all 5 canonical
    // weekday keys, but WorkerScheduleAgenda skips any with zero entries
    // before recess is ever considered -- so exactly one day section (and
    // therefore exactly 2 RECESO separators, not 10) should render.
    const html = renderToStaticMarkup(
      <WorkerScheduleAgenda entries={[classEntry({ weekday: "Lunes" })]} />
    );

    expect(html).toContain("Lunes");
    expect(html).not.toContain("Martes");
    expect(html).not.toContain("Miercoles");
    expect(html).not.toContain("Jueves");
    expect(html).not.toContain("Viernes");
    expect(html.match(/RECESO/g) ?? []).toHaveLength(2);
  });

  test("multiple displayed days each get their own pair of recess separators, never more", () => {
    const html = renderToStaticMarkup(
      <WorkerScheduleAgenda
        entries={[
          classEntry({ id: "assignment-lunes", weekday: "Lunes" }),
          classEntry({ id: "assignment-martes", weekday: "Martes" }),
        ]}
      />
    );

    expect(html).toContain("Lunes");
    expect(html).toContain("Martes");
    expect(html.match(/RECESO/g) ?? []).toHaveLength(4);
  });

  test("zero entries at all renders no day sections and no recess separators", () => {
    const html = renderToStaticMarkup(<WorkerScheduleAgenda entries={[]} />);
    expect(html).not.toContain("RECESO");
    expect(html).not.toContain("Lunes");
  });

  test("recess is never rendered as a class/activity card", () => {
    const html = renderToStaticMarkup(
      <WorkerScheduleAgenda entries={[classEntry()]} />
    );
    // The recess separator's own text ("RECESO · 8:50 - 9:20") must not
    // be preceded by the "Clase"/"Actividad" kind label real entries get.
    const recessIndex = html.indexOf("RECESO");
    const nearbyText = html.slice(Math.max(0, recessIndex - 60), recessIndex);
    expect(nearbyText).not.toContain(">Clase<");
    expect(nearbyText).not.toContain(">Actividad<");
  });
});
