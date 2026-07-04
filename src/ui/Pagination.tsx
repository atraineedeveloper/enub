import styled from "styled-components";
import UntypedButton from "./Button";
import type { ButtonHTMLAttributes, ComponentType } from "react";

// Button.jsx is a plain, untyped styled-component whose size/variation props
// are only consumed via runtime prop interpolation (see Button.jsx) — this
// local cast describes its real contract without converting that file.
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: "small" | "medium" | "large";
  variation?: "primary" | "secondary" | "danger";
};
const Button = UntypedButton as ComponentType<ButtonProps>;

const StyledPagination = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.2rem;
  width: 100%;
`;

const PageInfo = styled.p`
  font-size: 1.4rem;
  color: var(--color-grey-600);
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 0.8rem;
`;

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  onPageChange: (page: number) => void;
}

function Pagination({
  currentPage,
  totalPages,
  totalCount,
  onPageChange,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <StyledPagination>
      <PageInfo>
        Página {currentPage} de {totalPages} ({totalCount} registros)
      </PageInfo>
      <ButtonGroup>
        <Button
          size="small"
          variation="secondary"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          Anterior
        </Button>
        <Button
          size="small"
          variation="secondary"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          Siguiente
        </Button>
      </ButtonGroup>
    </StyledPagination>
  );
}

export default Pagination;
