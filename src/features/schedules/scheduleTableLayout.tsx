import type { ReactNode } from "react";
import styled from "styled-components";
import { WEEKDAYS } from "../../helpers/constants";

// Single source of truth for the schedule table's shape -- container,
// day header, time column, block rows, recess rows, and the divider row --
// consumed identically by the administrative schedules (ShowScholarSchedule/
// ShowTeacherSchedule/RowScholarSchedule/RowTeacherSchedule) and by the
// worker's read-only WorkerScheduleGrid. Every visual value below (border,
// radius, background, padding, column proportions, alignment) is copied
// from the admin implementation that existed before this change
// (ShowScholarSchedule.tsx/ShowTeacherSchedule.tsx's `Table`/`TableHeader`,
// RowScholarSchedule.tsx/RowTeacherSchedule.tsx's `TableRow`/`LongRow`/
// `LongRowComplete`) -- this module does not invent a new look, it
// relocates the admin's existing one into a single place both surfaces
// import, styled as a real semantic <table> instead of the admin's
// original `<div role="table">` CSS grid (a strict accessibility
// improvement -- real <thead>/<th scope>/<td>/colSpan -- with no visible
// difference, verified value-for-value against the admin CSS being
// replaced).
//
// These components carry zero authorization/query/mutation knowledge and
// accept no `readOnly`/`admin` prop of any kind: every one of them renders
// exactly what it's given via `children`/`renderCell` and nothing else. A
// caller that never imports an interactive element (Modal, ActionButton,
// ConfirmDelete, a form) can never have one appear in its rendered tree --
// there is no internal branch here that could add one, so there is nothing
// to hide with CSS in the first place.

export type ScheduleWeekday = (typeof WEEKDAYS)[number];

// Standard visually-hidden (not display:none/visibility:hidden, both of
// which remove an element from the accessibility tree too) clip pattern --
// keeps the "Hora" column header and the table's caption available to
// assistive technology while matching the admin's actual visible look
// (a blank corner cell, no caption text at all).
export const VisuallyHidden = styled.span`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
`;

// Matches the admin `Table` styled.div exactly (border/radius/background/
// font-size), now on a real <table> with border-collapse so the borders
// declared on rows/cells below render as single hairlines, not doubled.
const StyledTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  border: 1px solid var(--color-grey-200);
  border-radius: 7px;
  background-color: var(--color-grey-0);
  font-size: 1.4rem;
  overflow: hidden;
`;

// Matches the admin `TableHeader` styled.header exactly (background/
// border-bottom/uppercase/letter-spacing/font-weight/color/padding). Six
// equal-width columns (time + 5 weekdays), same as the admin's
// `grid-template-columns: 1fr 1fr 1fr 1fr 1fr 1fr` -- the time column is
// NOT narrower than a weekday column, matching the admin exactly (a real
// difference the previous worker-only table got wrong).
const HeaderCell = styled.th`
  width: ${100 / 6}%;
  padding: 1.6rem 1.2rem;
  text-align: center;
  background-color: var(--color-grey-50);
  border-bottom: 1px solid var(--color-grey-100);
  text-transform: uppercase;
  letter-spacing: 0.4px;
  font-weight: 600;
  color: var(--color-grey-600);
`;

// The row-header ("time") cell reuses the exact same visual treatment as a
// day-column header cell in the admin's grid (both were plain, unstyled
// grid items sharing the row's own padding/alignment) -- left as a plain,
// unadorned cell rather than a second distinct header style.
const TimeHeaderCell = styled.th`
  width: ${100 / 6}%;
  padding: 1.4rem 1.2rem;
  text-align: center;
  vertical-align: middle;
  font-weight: 400;
  color: inherit;
`;

const BodyCell = styled.td`
  width: ${100 / 6}%;
  padding: 1.4rem 1.2rem;
  text-align: center;
  vertical-align: middle;
  border-top: 1px solid var(--color-grey-100);
  // Fixed column widths (table-layout: fixed) already keep the table's own
  // width stable; this additionally keeps a single long, unbroken word
  // (a long subject/activity name with no spaces) from visually
  // overflowing its own fixed-width cell -- normal-length content wraps
  // exactly as it already did, unaffected.
  overflow-wrap: break-word;
`;

// Matches the admin `LongRow`'s plain `<p>RECESO</p>` -- no distinct
// background, no bold weight, no letter-spacing. The previous
// worker-only recess cell's grey-100 highlight is deliberately dropped
// here so both surfaces render the identical, plain admin treatment.
const RecessCell = styled.td`
  padding: 1.4rem 1.2rem;
  text-align: center;
  vertical-align: middle;
  border-top: 1px solid var(--color-grey-100);
`;

// Matches the admin `LongRowComplete` -- a single full-width divider row,
// plain centered text, no distinct background.
const DividerCell = styled.td`
  padding: 1.4rem 1.2rem;
  text-align: center;
  vertical-align: middle;
  border-top: 1px solid var(--color-grey-100);
  font-weight: 600;
`;

interface ScheduleTableProps {
  /** Visually hidden (matches the admin's actual blank table -- no visible title). */
  caption: string;
  children: ReactNode;
}

/** The table container -- border/radius/background, real <table> + <caption>. */
export function ScheduleTable({ caption, children }: ScheduleTableProps) {
  return (
    <StyledTable>
      <caption>
        <VisuallyHidden>{caption}</VisuallyHidden>
      </caption>
      {children}
    </StyledTable>
  );
}

interface ScheduleTableHeaderProps {
  weekdays?: readonly ScheduleWeekday[];
}

/**
 * The day-header row. The corner cell is visually blank (matches the
 * admin's `<div></div>`) but keeps an accessible "Hora" label for
 * assistive technology -- the admin never showed this text visibly, so
 * this is not a visible regression from the admin's own table, only an
 * accessibility addition invisible to sighted users.
 */
export function ScheduleTableHeader({ weekdays = WEEKDAYS }: ScheduleTableHeaderProps) {
  return (
    <thead>
      <tr>
        <HeaderCell scope="col">
          <VisuallyHidden>Hora</VisuallyHidden>
        </HeaderCell>
        {weekdays.map((day) => (
          <HeaderCell scope="col" key={day.value}>
            {day.label}
          </HeaderCell>
        ))}
      </tr>
    </thead>
  );
}

/** A single schedule cell -- renders exactly `children`, nothing else, ever. */
export function ScheduleCell({ children }: { children?: ReactNode }) {
  return <BodyCell>{children}</BodyCell>;
}

interface ScheduleBlockRowProps {
  timeLabel: string;
  weekdays?: readonly ScheduleWeekday[];
  /**
   * Owns the full weekday iteration so every caller renders exactly the
   * same day sequence/count -- a caller cannot accidentally omit or
   * duplicate a weekday, since it never writes the .map() itself.
   */
  renderCell: (weekday: ScheduleWeekday, index: number) => ReactNode;
}

/** A teachable-block row: one time-header cell + one cell per weekday. */
export function ScheduleBlockRow({
  timeLabel,
  weekdays = WEEKDAYS,
  renderCell,
}: ScheduleBlockRowProps) {
  return (
    <tr>
      <TimeHeaderCell scope="row">{timeLabel}</TimeHeaderCell>
      {weekdays.map((day, index) => (
        <ScheduleCell key={day.value}>{renderCell(day, index)}</ScheduleCell>
      ))}
    </tr>
  );
}

interface ScheduleRecessRowProps {
  timeLabel: string;
  label?: string;
  weekdayCount?: number;
}

/** A fixed recess row: time-header cell + one cell spanning every weekday column. */
export function ScheduleRecessRow({
  timeLabel,
  label = "RECESO",
  weekdayCount = WEEKDAYS.length,
}: ScheduleRecessRowProps) {
  return (
    <tr>
      <TimeHeaderCell scope="row">{timeLabel}</TimeHeaderCell>
      <RecessCell colSpan={weekdayCount}>{label}</RecessCell>
    </tr>
  );
}

interface ScheduleDividerRowProps {
  label: string;
  columnCount?: number;
}

/** A full-width divider row (e.g. "HORARIO EXTRACURRICULAR"), spanning every column. */
export function ScheduleDividerRow({
  label,
  columnCount = WEEKDAYS.length + 1,
}: ScheduleDividerRowProps) {
  return (
    <tr>
      <DividerCell colSpan={columnCount}>{label}</DividerCell>
    </tr>
  );
}
