import styled from "styled-components";
import Heading from "../../ui/Heading";
import {
  formatScheduleTime,
  formatScheduleWeekday,
  sortIncompleteScheduleEntries,
  type WorkerScheduleEntry,
} from "./workerScheduleEntry";

const Section = styled.section`
  margin-top: 2.4rem;
  padding: 1.6rem;
  background-color: var(--color-grey-50);
  border: 1px solid var(--color-grey-200);
  border-radius: var(--border-radius-md);
`;

const SectionHeading = styled(Heading)`
  margin-bottom: 1.2rem;
`;

const EntryList = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
`;

const EntryCard = styled.li`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.4rem 1.2rem;
  padding: 1rem 1.2rem;
  background-color: var(--color-grey-0);
  border: 1px solid var(--color-grey-100);
  border-radius: var(--border-radius-sm);
  font-size: 1.4rem;
`;

const KindTag = styled.span<{ $kind: WorkerScheduleEntry["kind"] }>`
  font-weight: 700;
  color: ${(props) =>
    props.$kind === "class" ? "var(--color-gold-700)" : "var(--color-gov-green-700)"};
`;

const MetaText = styled.span`
  color: var(--color-grey-500);
`;

interface WorkerScheduleUnspecifiedProps {
  entries: WorkerScheduleEntry[];
}

// Shown on both desktop and mobile: the actual authorized entries that
// could not be placed in the normal grid/agenda -- never a count or a
// warning banner (design.md §9a). Each entry shows its real content, using
// the exact per-field fallback text only for the specific field that is
// actually missing or malformed.
function WorkerScheduleUnspecified({ entries }: WorkerScheduleUnspecifiedProps) {
  if (entries.length === 0) return null;

  const sorted = sortIncompleteScheduleEntries(entries);

  return (
    <Section aria-label="Horario no especificado">
      <SectionHeading as="h2">Horario no especificado</SectionHeading>
      <EntryList>
        {sorted.map((entry) => (
          <EntryCard key={entry.id}>
            <KindTag $kind={entry.kind}>
              {entry.kind === "class" ? "Clase" : "Actividad"}
            </KindTag>
            <span>{formatScheduleWeekday(entry.weekday)}</span>
            <MetaText>{formatScheduleTime(entry.startTime, entry.endTime)}</MetaText>
            {entry.kind === "class" ? (
              <>
                <span>{entry.subject}</span>
                <MetaText>{entry.group}</MetaText>
              </>
            ) : (
              <span>{entry.activity}</span>
            )}
          </EntryCard>
        ))}
      </EntryList>
    </Section>
  );
}

export default WorkerScheduleUnspecified;
