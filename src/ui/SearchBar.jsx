import styled from "styled-components";
import { HiMagnifyingGlass } from "react-icons/hi2";

const Wrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;
`;

const StyledInput = styled.input`
  border: 1px solid var(--color-grey-300);
  background-color: var(--color-grey-0);
  border-radius: var(--border-radius-sm);
  padding: 0.8rem 1.2rem 0.8rem 3.2rem;
  box-shadow: var(--shadow-sm);
  font-size: 1.4rem;
  width: 24rem;

  &:focus {
    outline: 2px solid var(--color-brand-600);
    outline-offset: -1px;
  }
`;

const Icon = styled(HiMagnifyingGlass)`
  position: absolute;
  left: 1rem;
  width: 1.6rem;
  height: 1.6rem;
  color: var(--color-grey-400);
`;

function SearchBar({ value, onChange, placeholder = "Buscar..." }) {
  return (
    <Wrapper>
      <Icon />
      <StyledInput
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />
    </Wrapper>
  );
}

export default SearchBar;
