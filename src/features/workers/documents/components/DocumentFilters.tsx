import styled from "styled-components";
import { HiMagnifyingGlass } from "react-icons/hi2";
import type { DocumentStatusFilter } from "../documentRequirementSummary";

const FiltersBar = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 1.2rem;
  padding: 0.4rem 0;
`;

const ChipGroup = styled.div`
  display: flex;
  gap: 0.4rem;
`;

const Chip = styled.button<{ $active: boolean }>`
  border: 1px solid
    ${(props) => (props.$active ? "var(--color-brand-600)" : "var(--color-grey-300)")};
  background-color: ${(props) =>
    props.$active ? "var(--color-brand-50, var(--color-grey-50))" : "var(--color-grey-0)"};
  color: ${(props) => (props.$active ? "var(--color-brand-700)" : "var(--color-grey-600)")};
  border-radius: 999px;
  padding: 0.6rem 1.2rem;
  font-size: 1.3rem;
  font-weight: 600;
  min-height: 3.6rem;
  white-space: nowrap;
`;

const SearchWrapper = styled.div`
  position: relative;
  flex: 1 1 20rem;
  min-width: 16rem;
  max-width: 32rem;
  display: flex;
  align-items: center;

  & svg {
    position: absolute;
    left: 1rem;
    width: 1.6rem;
    height: 1.6rem;
    color: var(--color-grey-400);
    pointer-events: none;
  }
`;

const SearchInput = styled.input`
  width: 100%;
  font-size: 1.4rem;
  padding: 0.8rem 1.2rem 0.8rem 3.2rem;
  border: 1px solid var(--color-grey-300);
  border-radius: var(--border-radius-sm);
  background-color: var(--color-grey-0);
  min-height: 3.6rem;
`;

const FILTER_OPTIONS: { value: DocumentStatusFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Pendientes" },
  { value: "withFiles", label: "Con archivos" },
];

interface DocumentFiltersProps {
  filter: DocumentStatusFilter;
  onFilterChange: (filter: DocumentStatusFilter) => void;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
}

function DocumentFilters({
  filter,
  onFilterChange,
  searchTerm,
  onSearchTermChange,
}: DocumentFiltersProps) {
  return (
    <FiltersBar>
      <ChipGroup role="group" aria-label="Filtrar por estado">
        {FILTER_OPTIONS.map((option) => (
          <Chip
            key={option.value}
            type="button"
            $active={filter === option.value}
            aria-pressed={filter === option.value}
            onClick={() => onFilterChange(option.value)}
          >
            {option.label}
          </Chip>
        ))}
      </ChipGroup>
      <SearchWrapper>
        <HiMagnifyingGlass aria-hidden="true" />
        <SearchInput
          type="search"
          value={searchTerm}
          onChange={(event) => onSearchTermChange(event.target.value)}
          placeholder="Buscar requisito..."
          aria-label="Buscar requisito por nombre"
        />
      </SearchWrapper>
    </FiltersBar>
  );
}

export default DocumentFilters;
