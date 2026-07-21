import styled from "styled-components";
import type { DocumentProgressSummary } from "../documentRequirementSummary";

const SummaryBar = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 1.2rem;
  padding: 1.2rem 0;
`;

const Counts = styled.p<{ $muted?: boolean }>`
  color: var(--color-grey-600);
  font-size: 1.4rem;
  margin: 0;
  white-space: nowrap;
  opacity: ${(props) => (props.$muted ? 0.55 : 1)};
`;

const UpdatingNote = styled.span`
  color: var(--color-grey-500);
  font-size: 1.3rem;
  font-style: italic;
`;

interface DocumentSummaryProps {
  summary: DocumentProgressSummary;
  isUpdatingSemesterData?: boolean;
}

// Objective counts only -- deliberately no percentage/completion rate and
// no progress bar (design decision: requirements don't necessarily carry
// equal weight, and there is no formal compliance rule that a single
// percentage could honestly represent; see
// documentRequirementSummary.ts's computeDocumentProgressSummary).
// A human message when there are zero active requirements at all --
// avoids ever rendering a meaningless "0 requisitos · 0 con archivos · 0
// pendientes".
//
// While isUpdatingSemesterData is true, `summary` still reflects the
// PREVIOUS period's documents (placeholderData) -- never presented as if
// it were the new period's real result. The counts stay visible (dimmed,
// for context) with "Actualizando periodo…" appended, rather than being
// hidden or silently recomputed as if already accurate.
function DocumentSummary({ summary, isUpdatingSemesterData = false }: DocumentSummaryProps) {
  if (summary.totalActive === 0) {
    return (
      <SummaryBar>
        <Counts>No hay requisitos activos configurados.</Counts>
      </SummaryBar>
    );
  }

  return (
    <SummaryBar>
      <Counts $muted={isUpdatingSemesterData}>
        {summary.totalActive} {summary.totalActive === 1 ? "requisito" : "requisitos"} ·{" "}
        {summary.withFiles} con archivos ·{" "}
        {summary.pending} {summary.pending === 1 ? "pendiente" : "pendientes"}
      </Counts>
      {isUpdatingSemesterData && <UpdatingNote>Actualizando periodo…</UpdatingNote>}
    </SummaryBar>
  );
}

export default DocumentSummary;
