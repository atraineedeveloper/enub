import styled, { css } from "styled-components";

// Shared, compact icon-button treatment for schedule-cell actions
// (Add/Edit/Delete), used by both the teacher and the scholar/group
// timetables -- a visible bordered surface instead of a bare icon, with
// hover/active states and a `danger` variant for Delete. Native
// <button>s already pick up the app-wide `button:focus` outline from
// GlobalStyles.ts, so keyboard-focus visibility comes for free.
export const ScheduleActionButton = styled.button<{ $variation?: "danger" }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.8rem;
  height: 2.8rem;
  border: 1px solid var(--color-grey-300);
  border-radius: var(--border-radius-sm);
  background-color: var(--color-grey-0);
  color: var(--color-brand-600);
  transition: background-color 0.15s ease, border-color 0.15s ease;

  & svg {
    width: 1.5rem;
    height: 1.5rem;
  }

  &:hover {
    background-color: var(--color-brand-50);
    border-color: var(--color-brand-600);
  }

  &:active {
    background-color: var(--color-grey-100);
  }

  ${(props) =>
    props.$variation === "danger" &&
    css`
      color: var(--color-red-700);

      &:hover {
        background-color: var(--color-red-100);
        border-color: var(--color-red-700);
      }
    `}
`;

export const ScheduleActionsRow = styled.div`
  display: flex;
  gap: 0.6rem;
  justify-content: center;
  margin-top: 0.4rem;
`;
