import { Fragment } from "react";
import styled from "styled-components";
import { selectCellEntries, type WorkerScheduleEntry } from "./workerScheduleEntry";
import {
  formatSchoolDayBlockLabel,
  getWorkerScheduleDayBlocks,
  hasExtracurricularBlock,
} from "./schoolDayBlocks";
import {
  ScheduleBlockRow,
  ScheduleDividerRow,
  ScheduleRecessRow,
  ScheduleTable,
  ScheduleTableHeader,
} from "./scheduleTableLayout";
import { ScheduleEntryContent } from "./scheduleCellContent";

// Read-only desktop grid, now consuming the same structural components as
// the administrative schedules (scheduleTableLayout.tsx/
// scheduleCellContent.tsx) -- audit finding: a previous, independently-built
// version of this component visually diverged from the admin schedule
// (different container, header, row, and cell markup, plus a colored-chip
// content treatment the admin never had). This file now contributes zero
// visual decisions of its own: every border/padding/column-width/alignment
// comes from the shared components. The only thing distinguishing this
// file from the admin's own row components (RowScholarSchedule.tsx/
// RowTeacherSchedule.tsx) is that it never imports Modal, ActionButton,
// ConfirmDelete, or any create/edit/delete hook -- there is nothing to
// hide with CSS, because there is nothing here to hide.

// Kept local (not part of the shared table shape) -- specific to this
// worker-facing requirement (worker-schedule-viewing spec: "Tight desktop
// width scrolls within the grid, not the page"), which the admin schedule
// was never asked to satisfy. Wrapping the shared, unmodified <ScheduleTable>
// in a scroll boundary changes nothing about the table's own structure.
const TableShell = styled.div`
  overflow-x: auto;
`;

interface WorkerScheduleGridProps {
  entries: WorkerScheduleEntry[];
}

function WorkerScheduleGrid({ entries }: WorkerScheduleGridProps) {
  const blocks = getWorkerScheduleDayBlocks(entries);
  const showExtracurricularDivider = hasExtracurricularBlock(blocks);

  return (
    <TableShell>
      <ScheduleTable caption="Horario semanal">
        <ScheduleTableHeader />
        <tbody>
          {blocks.map((block) => {
            const rowLabel = formatSchoolDayBlockLabel(block.startTime, block.endTime);

            if (block.kind === "recess") {
              return (
                <ScheduleRecessRow key={`recess-${block.startTime}`} timeLabel={rowLabel} />
              );
            }

            const isExtracurricularBlock =
              showExtracurricularDivider && block.startTime === "17:00:00";

            return (
              <Fragment key={block.startTime}>
                {isExtracurricularBlock && (
                  <ScheduleDividerRow label="HORARIO EXTRACURRICULAR" />
                )}
                <ScheduleBlockRow
                  timeLabel={rowLabel}
                  renderCell={(day) => {
                    // Sorted per cell (workerScheduleEntry.ts's
                    // compareWorkerScheduleEntries) so rendered order is
                    // deterministic regardless of the source array's own
                    // order -- unchanged from the previous implementation.
                    const cellEntries = selectCellEntries(
                      entries,
                      day.value,
                      block.startTime,
                      block.endTime
                    );

                    return cellEntries.map((entry) => (
                      <ScheduleEntryContent
                        key={entry.id}
                        kind={entry.kind}
                        primaryText={
                          entry.kind === "class" ? entry.subject : entry.activity
                        }
                        secondaryText={entry.kind === "class" ? entry.group : undefined}
                      />
                    ));
                  }}
                />
              </Fragment>
            );
          })}
        </tbody>
      </ScheduleTable>
    </TableShell>
  );
}

export default WorkerScheduleGrid;
