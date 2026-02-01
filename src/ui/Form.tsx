import styled, { css } from "styled-components";
import type { FormHTMLAttributes } from "react";

interface FormProps extends FormHTMLAttributes<HTMLFormElement> {
  type?: "modal" | "default";
}

const Form = styled.form<FormProps>`
  ${(props) =>
    props.type !== "modal" &&
    css`
      padding: 2.4rem 4rem;

      /* Box */
      background-color: var(--color-grey-0);
      border: 1px solid var(--color-grey-100);
      border-radius: var(--border-radius-md);
    `}

  ${(props) =>
    props.type === "modal" &&
    css`
      width: 80rem;
      max-width: 100%;
      padding: 2rem;
    `}
    
  overflow: hidden;
  font-size: 1.4rem;

  @media (max-width: 900px) {
    width: 100%;
    padding: 1.6rem;
  }
`;

export default Form;
