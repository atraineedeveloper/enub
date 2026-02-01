import styled, { css } from "styled-components";
import type { HTMLAttributes } from "react";

interface RowProps extends HTMLAttributes<HTMLDivElement> {
  type?: "horizontal" | "vertical";
}

const Row = styled.div<RowProps>`
  display: flex;
  padding: 1rem 0;

  ${(props) =>
    props.type === "horizontal" &&
    css`
      justify-content: space-between;
      align-items: center;
    `}

  ${(props) =>
    props.type === "vertical" &&
    css`
      flex-direction: column;
      gap: 1.6rem;
    `}
`;

Row.defaultProps = {
  type: "vertical",
};

export default Row;
