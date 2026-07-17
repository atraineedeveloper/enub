import styled from "styled-components";
import Heading from "../../ui/Heading";
import {
  formatScheduleTime,
  groupWorkerScheduleByWeekday,
  sortWorkerScheduleEntries,
  type WorkerScheduleEntry,
} from "./workerScheduleEntry";
import {
  formatSchoolDayBlockLabel,
  mergeRecessIntoDayEntries,
} from "./schoolDayBlocks";

const DaySection = styled.section`
  margin-bottom: 1.6rem;
`;

const DayHeading = styled(Heading)`
  margin-bottom: 0.8rem;
`;

const EntryList = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
`;

const EntryCard = styled.li`
  padding: 1.2rem;
  background-color: var(--color-grey-0);
  border: 1px solid var(--color-grey-200);
  border-radius: var(--border-radius-md);
  font-size: 1.4rem;
`;

const EntryKindLabel = styled.p<{ $kind: WorkerScheduleEntry["kind"] }>`
  font-weight: 700;
  margin-bottom: 0.4rem;
  color: ${(props) =>
    props.$kind === "class" ? "var(--color-gold-700)" : "var(--color-gov-green-700)"};
`;

const EntryTime = styled.p`
  color: var(--color-grey-500);
  font-size: 1.3rem;
  margin-bottom: 0.2rem;
`;

// The school's fixed recess periods, rendered as a static separator
// between real entries -- never a class/activity card, never fetched,
// never counted as schedule data. Same neutral --color-grey-* pairing as
// the desktop recess cell, contrast-checked in both themes; the "RECESO"
// text is what conveys meaning, not the dashed border/background alone.
// Relative units only (no fixed widths), consistent with the rest of
// this list, so it stays usable at narrow (360px) viewports.
const RecessCard = styled.li`
  padding: 1rem 1.2rem;
  background-color: var(--color-grey-100);
  border: 1px dashed var(--color-grey-300);
  border-radius: var(--border-radius-md);
  font-size: 1.3rem;
  font-weight: 700;
  letter-spacing: 0.4px;
  color: var(--color-grey-700);
  text-align: center;
`;

interface WorkerScheduleAgendaProps {
  entries: WorkerScheduleEntry[];
}

// Day-grouped agenda/card list, consuming the identical normalized array
// the desktop grid uses -- entries chronological within each day, full
// width, stacked. Never depends on a horizontal layout.
function WorkerScheduleAgenda({ entries }: WorkerScheduleAgendaProps) {
  const sorted = sortWorkerScheduleEntries(entries);
  const grouped = groupWorkerScheduleByWeekday(sorted);

  return (
    <div>
      {[...grouped.entries()].map(([day, dayEntries]) => {
        // Days with no real entries are skipped entirely, before recess
        // is ever considered -- a day is never created solely to display
        // the fixed recess periods.
        if (dayEntries.length === 0) return null;

        return (
          <DaySection key={day} aria-label={day}>
            <DayHeading as="h3">{day}</DayHeading>
            <EntryList>
              {mergeRecessIntoDayEntries(dayEntries).map((item) =>
                item.kind === "recess" ? (
                  <RecessCard key={item.id}>
                    {item.label} · {formatSchoolDayBlockLabel(item.startTime, item.endTime)}
                  </RecessCard>
                ) : (
                  <EntryCard key={item.entry.id}>
                    <EntryKindLabel $kind={item.entry.kind}>
                      {item.entry.kind === "class" ? "Clase" : "Actividad"}
                    </EntryKindLabel>
                    <EntryTime>
                      {formatScheduleTime(item.entry.startTime, item.entry.endTime)}
                    </EntryTime>
                    {item.entry.kind === "class" ? (
                      <>
                        <p>{item.entry.subject}</p>
                        <p>{item.entry.group}</p>
                      </>
                    ) : (
                      <p>{item.entry.activity}</p>
                    )}
                  </EntryCard>
                )
              )}
            </EntryList>
          </DaySection>
        );
      })}
    </div>
  );
}

export default WorkerScheduleAgenda;
