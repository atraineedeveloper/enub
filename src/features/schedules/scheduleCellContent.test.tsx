import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ScheduleEntryContent } from "./scheduleCellContent";

describe("ScheduleEntryContent", () => {
  test("a class entry uppercases the subject and prefixes it with 'Clase —'", () => {
    const html = renderToStaticMarkup(
      <ScheduleEntryContent kind="class" primaryText="Matemáticas" />
    );
    expect(html).toContain("Clase — MATEMÁTICAS");
  });

  test("an activity entry keeps its own casing and is prefixed with 'Actividad —'", () => {
    const html = renderToStaticMarkup(
      <ScheduleEntryContent kind="activity" primaryText="Guardia de pasillo" />
    );
    expect(html).toContain("Actividad — Guardia de pasillo");
    expect(html).not.toContain("GUARDIA");
  });

  test("a class entry's secondary text (group or teacher name) renders on its own line", () => {
    const html = renderToStaticMarkup(
      <ScheduleEntryContent kind="class" primaryText="Español" secondaryText='1° "A" - PREE' />
    );
    expect(html).toContain("<em>");
    expect(html).toContain('1° &quot;A&quot; - PREE');
  });

  test("an activity entry with no secondary text renders no <em> line at all", () => {
    const html = renderToStaticMarkup(
      <ScheduleEntryContent kind="activity" primaryText="Guardia" />
    );
    expect(html).not.toContain("<em>");
  });

  test("children (admin-only edit/delete controls) render after the text when provided", () => {
    const html = renderToStaticMarkup(
      <ScheduleEntryContent kind="class" primaryText="Historia">
        <button type="button">Editar</button>
      </ScheduleEntryContent>
    );
    expect(html).toContain("<button");
    expect(html).toContain("Editar");
  });

  test("no children renders no button/interactive element at all -- the worker caller's exact usage", () => {
    const html = renderToStaticMarkup(
      <ScheduleEntryContent kind="class" primaryText="Historia" secondaryText="1A" />
    );
    expect(html).not.toContain("<button");
    expect(html).not.toContain("<form");
  });
});
