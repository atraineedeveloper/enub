import type { ReactNode } from "react";

// The one shared way to render a class or activity entry's text inside a
// schedule cell -- used identically by the admin's interactive cells
// (HourScheduleSubject.tsx, HourScheduleSubjectGroup.tsx,
// HourScheduleTeacher.tsx, which pass their own edit/delete controls as
// `children`) and by the worker's read-only grid (which never passes
// `children` at all, so no action ever renders in that tree). Matches the
// admin's original markup shape exactly (`<b>...</b><br/><em>...</em>`),
// with the entry kind ("Clase"/"Actividad") folded into the bold line
// instead of the admin's previous implicit-only distinction -- required so
// kind is conveyed as visible text, not merely by which component/column
// happened to render it (see worker-schedule-viewing spec's "Schedule
// information is understandable without color").

export type ScheduleEntryKind = "class" | "activity";

interface ScheduleEntryContentProps {
  kind: ScheduleEntryKind;
  /** The subject name (class) or activity text (activity). */
  primaryText: string;
  /** Group descriptor (class) or teacher name (class, group-perspective view). Never shown for an activity. */
  secondaryText?: string;
  /** Admin-only edit/delete controls. The worker caller never passes this. */
  children?: ReactNode;
}

const KIND_LABELS: Record<ScheduleEntryKind, string> = {
  class: "Clase",
  activity: "Actividad",
};

export function ScheduleEntryContent({
  kind,
  primaryText,
  secondaryText,
  children,
}: ScheduleEntryContentProps) {
  // Matches the admin's existing `.toUpperCase()` treatment for a class's
  // subject name (HourScheduleSubject.tsx/HourScheduleSubjectGroup.tsx);
  // an activity's own text was never uppercased in the admin
  // (HourScheduleTeacher.tsx), so it isn't here either.
  const displayPrimary = kind === "class" ? primaryText.toUpperCase() : primaryText;

  return (
    <div>
      <b>
        {KIND_LABELS[kind]} — {displayPrimary}
      </b>
      {secondaryText && (
        <>
          <br />
          <em>{secondaryText}</em>
        </>
      )}
      {children}
    </div>
  );
}
