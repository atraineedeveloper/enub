import styled from "styled-components";
import type { DocumentProgressSummary } from "../documentRequirementSummary";

const SummaryBar = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 1.2rem;
  padding: 1.2rem 0;
`;

const Counts = styled.p`
  color: var(--color-grey-600);
  font-size: 1.4rem;
  margin: 0;
  white-space: nowrap;
`;

// Discrete, not a hero element: a thin track, no animation, no large
// numerals -- the counts text carries the information, this is a
// secondary visual confirmation of it.
const ProgressTrack = styled.div`
  flex: 1 1 16rem;
  min-width: 12rem;
  height: 0.6rem;
  border-radius: 999px;
  background-color: var(--color-grey-100);
  overflow: hidden;
`;

const ProgressFill = styled.div<{ $percentage: number }>`
  height: 100%;
  width: ${(props) => props.$percentage}%;
  background-color: var(--color-brand-600);
  border-radius: 999px;
  transition: width 0.2s ease;
`;

const ProgressLabel = styled.span`
  color: var(--color-grey-500);
  font-size: 1.3rem;
  white-space: nowrap;
`;

interface DocumentSummaryProps {
  summary: DocumentProgressSummary;
}

// A human message when there are zero active requirements at all --
// avoids ever rendering a 0/0 or a bar with no meaning.
function DocumentSummary({ summary }: DocumentSummaryProps) {
  if (summary.totalActive === 0) {
    return (
      <SummaryBar>
        <Counts>No hay requisitos activos configurados.</Counts>
      </SummaryBar>
    );
  }

  return (
    <SummaryBar>
      <Counts>
        {summary.totalActive} {summary.totalActive === 1 ? "requisito" : "requisitos"} ·{" "}
        {summary.withFiles} con archivos · {summary.pending} pendientes
      </Counts>
      <ProgressTrack
        role="progressbar"
        aria-valuenow={summary.percentage ?? 0}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progreso del expediente documental"
      >
        <ProgressFill $percentage={summary.percentage ?? 0} />
      </ProgressTrack>
      <ProgressLabel>{summary.percentage}%</ProgressLabel>
    </SummaryBar>
  );
}

export default DocumentSummary;
