import styled, { css } from "styled-components";

interface RowOwnProps {
  type?: "horizontal" | "vertical";
}

const Row = styled.div<RowOwnProps>`
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
