import styled from "styled-components";
import type { InputHTMLAttributes } from "react";

const StyledFileInput = styled.input`
  width: 100%;
  font-size: 1.4rem;
  color: var(--color-grey-700);
`;

type FileInputProps = InputHTMLAttributes<HTMLInputElement>;

function FileInput(props: FileInputProps) {
  return <StyledFileInput type="file" {...props} />;
}

export default FileInput;
