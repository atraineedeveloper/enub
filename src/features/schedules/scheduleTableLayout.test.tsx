import { describe, expect, test } from "bun:test";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ServerStyleSheet } from "styled-components";
import { WEEKDAYS } from "../../helpers/constants";
import {
  ScheduleBlockRow,
  ScheduleCell,
  ScheduleDividerRow,
  ScheduleRecessRow,
  ScheduleTable,
  ScheduleTableHeader,
} from "./scheduleTableLayout";

function renderInTable(children: ReactNode) {
  return renderToStaticMarkup(
    <ScheduleTable caption="Horario semanal">
      <ScheduleTableHeader />
      <tbody>{children}</tbody>
    </ScheduleTable>
  );
}

describe("ScheduleTable / ScheduleTableHeader", () => {
  test("renders a real semantic <table> with a <caption>", () => {
    const html = renderInTable(null);
    expect(html).toContain("<table");
    expect(html).toContain("<caption");
  });

  test("the caption text is present in markup (accessible even though not visible -- see manual verification steps)", () => {
    const html = renderInTable(null);
    expect(html).toContain("Horario semanal");
  });

  test("the corner header cell keeps an accessible 'Hora' label", () => {
    const html = renderInTable(null);
    expect(html).toContain("Hora");
  });

  test("exactly six header cells: the corner cell + one per weekday, in order", () => {
    const html = renderInTable(null);
    const headerCells = html.match(/<th[^>]*scope="col"[^>]*>/g) ?? [];
    expect(headerCells).toHaveLength(6);
  });

  test("every weekday label appears, in Lunes-Viernes order, none omitted", () => {
    const html = renderInTable(null);
    let searchFrom = 0;
    for (const day of WEEKDAYS) {
      const index = html.indexOf(day.label, searchFrom);
      expect(index).toBeGreaterThanOrEqual(searchFrom);
      searchFrom = index + day.label.length;
    }
  });
});

describe("ScheduleBlockRow", () => {
  test("renders exactly one cell per weekday, via renderCell, in weekday order", () => {
    const seen: string[] = [];
    const html = renderInTable(
      <ScheduleBlockRow
        timeLabel="7:00 - 8:50"
        renderCell={(day) => {
          seen.push(day.value);
          return day.value;
        }}
      />
    );

    expect(seen).toEqual(WEEKDAYS.map((d) => d.value));
    expect(html).toContain("7:00 - 8:50");
  });

  test("a caller cannot skip or duplicate a weekday -- the row always iterates the full canonical list", () => {
    let callCount = 0;
    renderInTable(
      <ScheduleBlockRow
        timeLabel="9:20 - 11:10"
        renderCell={() => {
          callCount++;
          return null;
        }}
      />
    );
    expect(callCount).toBe(WEEKDAYS.length);
  });

  test("cell content passed via renderCell is rendered inside a <td>", () => {
    const html = renderInTable(
      <ScheduleBlockRow
        timeLabel="11:10 - 13:00"
        renderCell={(day) => (day.value === "Lunes" ? "UNIQUE-CELL-MARKER" : null)}
      />
    );
    expect(html).toContain("<td");
    expect(html).toContain("UNIQUE-CELL-MARKER");
  });
});

describe("ScheduleCell", () => {
  test("renders exactly its children, nothing implied by default", () => {
    const html = renderToStaticMarkup(
      <table>
        <tbody>
          <tr>
            <ScheduleCell>only-this-content</ScheduleCell>
          </tr>
        </tbody>
      </table>
    );
    expect(html).toContain("only-this-content");
  });

  test("an empty cell (no children) renders no fallback text of any kind", () => {
    const html = renderToStaticMarkup(
      <table>
        <tbody>
          <tr>
            <ScheduleCell />
          </tr>
        </tbody>
      </table>
    );
    expect(html).toContain("<td");
    // No stray whitespace-only text node beyond the empty cell tag itself.
    expect(html.match(/<td[^>]*><\/td>/)).not.toBeNull();
  });
});

describe("ScheduleRecessRow", () => {
  test("spans all five weekday columns with the default RECESO label", () => {
    const html = renderInTable(<ScheduleRecessRow timeLabel="8:50 - 9:20" />);
    expect(html).toContain("8:50 - 9:20");
    expect(html).toContain("RECESO");
    expect(html).toContain('colSpan="5"');
  });

  test("a custom label overrides the default", () => {
    const html = renderInTable(<ScheduleRecessRow timeLabel="13:00 - 13:10" label="DESCANSO" />);
    expect(html).toContain("DESCANSO");
    expect(html).not.toContain("RECESO");
  });

  test("only one cell exists besides the time header -- no per-weekday cell for a recess row", () => {
    const html = renderInTable(<ScheduleRecessRow timeLabel="8:50 - 9:20" />);
    const cellCount = (html.match(/<td/g) ?? []).length;
    expect(cellCount).toBe(1);
  });
});

describe("ScheduleDividerRow", () => {
  test("spans every column (time + all weekdays) by default", () => {
    const html = renderInTable(<ScheduleDividerRow label="HORARIO EXTRACURRICULAR" />);
    expect(html).toContain("HORARIO EXTRACURRICULAR");
    expect(html).toContain(`colSpan="${WEEKDAYS.length + 1}"`);
  });

  test("has no time-header cell of its own -- a single full-width cell only", () => {
    const html = renderInTable(<ScheduleDividerRow label="HORARIO EXTRACURRICULAR" />);
    const cellCount = (html.match(/<td/g) ?? []).length;
    expect(cellCount).toBe(1);
  });
});

describe("Long content does not cause horizontal overflow", () => {
  // Real generated CSS, extracted via styled-components' ServerStyleSheet
  // (not a string search over the rendered HTML, which never contains
  // inline CSS text for a className-based styled-component) -- proves the
  // actual applied rules, not an assumption about them. Full pixel-level
  // confirmation still needs the manual browser verification step (see
  // this change's manual verification steps).
  function collectCss(node: ReactNode): string {
    const sheet = new ServerStyleSheet();
    renderToStaticMarkup(sheet.collectStyles(node));
    const css = sheet.getStyleTags();
    sheet.seal();
    return css;
  }

  test("the table keeps a fixed layout -- column widths never grow to fit long content", () => {
    const css = collectCss(
      <ScheduleTable caption="x">
        <tbody>
          <ScheduleBlockRow
            timeLabel="7:00 - 8:50"
            renderCell={() =>
              "Unabreviatuwordthatisdeliberatelyverylongwithnospacesatallwhatsoever"
            }
          />
        </tbody>
      </ScheduleTable>
    );
    expect(css).toContain("table-layout:fixed");
  });

  test("cell content wraps on word boundaries and breaks a single very long unbroken word rather than overflow it", () => {
    const css = collectCss(
      <table>
        <tbody>
          <tr>
            <ScheduleCell>
              Unabreviatuwordthatisdeliberatelyverylongwithnospacesatallwhatsoever
            </ScheduleCell>
          </tr>
        </tbody>
      </table>
    );
    expect(css).toContain("overflow-wrap:break-word");
  });

  test("a very long unbroken string still renders in full (no truncation), just wrapped", () => {
    const longWord =
      "Unabreviatuwordthatisdeliberatelyverylongwithnospacesatallwhatsoever";
    const html = renderInTable(
      <ScheduleBlockRow timeLabel="9:20 - 11:10" renderCell={() => longWord} />
    );
    expect(html).toContain(longWord);
  });
});
