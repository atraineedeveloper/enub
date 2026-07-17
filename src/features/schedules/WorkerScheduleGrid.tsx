import styled from "styled-components";
import { WEEKDAYS } from "../../helpers/constants";
import { selectCellEntries, type WorkerScheduleEntry } from "./workerScheduleEntry";
import { WORKER_SCHEDULE_DAY_BLOCKS, formatSchoolDayBlockLabel } from "./schoolDayBlocks";

// New, worker-scoped presentational primitives -- visually aligned with
// the administrator schedule (same grid shape, same border/radius/header
// tokens, same gold/gov-green class/activity accents already tied to this
// exact distinction in ScheduleDashboard.tsx's tabAccents) but not
// code-shared with the admin's CRUD-coupled cell components
// (HourScheduleSubject.tsx, RowTeacherSchedule.tsx, etc. have no read-only
// seam -- see design.md §8, Decision 3). Zero query/authorization/loading
// logic lives here; this component only ever receives an already-resolved
// entry array as a prop.
//
// A native <table> (thead/tbody, <th scope="col"> for weekdays, <th
// scope="row"> for time-block labels, <td> for cells) rather than an ARIA
// grid built from styled <div>s: a screen reader gets weekday/time-block
// context for every cell "for free" from the table semantics, instead of
// depending on visual column/row position alone (audit finding:
// accessibility). The visual grid layout (fixed column widths, borders,
// horizontal scroll on narrow viewports) is preserved via CSS on the
// table itself -- <table> with border-collapse and explicit column widths
// renders identically to the previous CSS-grid version.

const TableShell = styled.div`
  border: 1px solid var(--color-grey-200);
  border-radius: var(--border-radius-md);
  background-color: var(--color-grey-0);
  overflow-x: auto;
`;

const ScheduleTable = styled.table`
  border-collapse: collapse;
  width: 100%;
  min-width: 84rem;
  table-layout: fixed;
`;

const Caption = styled.caption`
  caption-side: top;
  text-align: left;
  padding: 1.2rem 1.6rem;
  font-weight: 700;
  font-size: 1.4rem;
  color: var(--color-grey-700);
`;

const ColumnHeaderCell = styled.th`
  padding: 1.2rem 1.6rem;
  text-align: center;
  background-color: var(--color-grey-50);
  border-bottom: 1px solid var(--color-grey-100);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  font-size: 1.2rem;
  color: var(--color-grey-600);
  width: 14rem;

  &:first-child {
    width: 12rem;
  }
`;

const RowHeaderCell = styled.th`
  padding: 1.2rem 1.6rem;
  font-size: 1.3rem;
  font-weight: 600;
  color: var(--color-grey-600);
  background-color: var(--color-grey-50);
  border-right: 1px solid var(--color-grey-100);
  border-top: 1px solid var(--color-grey-100);
  text-align: left;
  vertical-align: middle;
`;

const ScheduleCell = styled.td`
  padding: 0.8rem;
  border-top: 1px solid var(--color-grey-100);
  border-left: 1px solid var(--color-grey-100);
  min-height: 6rem;
  vertical-align: top;
`;

const CellEntries = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
`;

// The school's two fixed recess periods -- a single cell spanning every
// weekday column (never per-weekday cells, since recess isn't
// weekday-specific data), text-centered, and never populated from
// `entries`. Background + text tokens are the same --color-grey-*
// pairing used elsewhere for neutral, non-mutation content, chosen for
// contrast in both themes (verified against both the light and
// `.dark-mode` custom-property sets in GlobalStyles.ts) -- the "RECESO"
// text itself is what conveys meaning, never color alone.
const RecessCell = styled.td`
  padding: 0.8rem;
  border-top: 1px solid var(--color-grey-100);
  border-left: 1px solid var(--color-grey-100);
  text-align: center;
  vertical-align: middle;
  font-weight: 700;
  font-size: 1.3rem;
  letter-spacing: 0.6px;
  color: var(--color-grey-700);
  background-color: var(--color-grey-100);
`;

const EntryChip = styled.div<{ $kind: WorkerScheduleEntry["kind"] }>`
  padding: 0.6rem 0.8rem;
  border-radius: var(--border-radius-sm);
  font-size: 1.2rem;
  line-height: 1.3;
  background-color: ${(props) =>
    props.$kind === "class" ? "var(--color-gold-100)" : "var(--color-gov-green-100)"};
  color: ${(props) =>
    props.$kind === "class" ? "var(--color-gold-800)" : "var(--color-gov-green-800)"};
`;

const EntryKindLabel = styled.p`
  font-weight: 700;
  margin-bottom: 0.2rem;
`;

interface WorkerScheduleGridProps {
  entries: WorkerScheduleEntry[];
}

function WorkerScheduleGrid({ entries }: WorkerScheduleGridProps) {
  return (
    <TableShell>
      <ScheduleTable>
        <Caption>Horario semanal</Caption>
        <thead>
          <tr>
            <ColumnHeaderCell scope="col">Hora</ColumnHeaderCell>
            {WEEKDAYS.map((day) => (
              <ColumnHeaderCell scope="col" key={day.value}>
                {day.label}
              </ColumnHeaderCell>
            ))}
          </tr>
        </thead>
        <tbody>
          {WORKER_SCHEDULE_DAY_BLOCKS.map((block) => {
            const rowLabel = formatSchoolDayBlockLabel(block.startTime, block.endTime);

            // Recess: one row, one cell spanning every weekday column --
            // never selectCellEntries, never a per-weekday cell, never
            // populated from `entries`. The school's recess periods are
            // fixed presentation facts, not schedule data.
            if (block.kind === "recess") {
              return (
                <tr key={`recess-${block.startTime}`}>
                  <RowHeaderCell scope="row">{rowLabel}</RowHeaderCell>
                  <RecessCell colSpan={WEEKDAYS.length}>{block.label}</RecessCell>
                </tr>
              );
            }

            return (
              <tr key={block.startTime}>
                <RowHeaderCell scope="row">{rowLabel}</RowHeaderCell>
                {WEEKDAYS.map((day) => {
                  // Sorted per cell (design.md §9b's compareWorkerScheduleEntries)
                  // so the rendered order is deterministic regardless of the
                  // source array's own order (audit finding: desktop cell
                  // ordering) -- never dependent on entries' incoming order.
                  const cellEntries = selectCellEntries(
                    entries,
                    day.value,
                    block.startTime,
                    block.endTime
                  );

                  return (
                    <ScheduleCell key={`${block.startTime}-${day.value}`}>
                      <CellEntries>
                        {cellEntries.map((entry) => (
                          <EntryChip key={entry.id} $kind={entry.kind}>
                            <EntryKindLabel>
                              {entry.kind === "class" ? "Clase" : "Actividad"}
                            </EntryKindLabel>
                            {entry.kind === "class" ? (
                              <>
                                <p>{entry.subject}</p>
                                <p>{entry.group}</p>
                              </>
                            ) : (
                              <p>{entry.activity}</p>
                            )}
                          </EntryChip>
                        ))}
                      </CellEntries>
                    </ScheduleCell>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </ScheduleTable>
    </TableShell>
  );
}

export default WorkerScheduleGrid;
