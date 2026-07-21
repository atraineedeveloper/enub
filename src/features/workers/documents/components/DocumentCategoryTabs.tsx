import styled from "styled-components";
import Select from "../../../../ui/Select";
import type { WorkerDocumentCategory } from "../useWorkerDocumentCatalog";

// Desktop/tablet: a horizontally-scrollable tablist (never wraps, never
// forces the page itself to scroll horizontally -- only this strip does).
// Hidden below the mobile breakpoint in favor of the <select> below.
const TabList = styled.div`
  display: flex;
  gap: 0.4rem;
  overflow-x: auto;
  padding-bottom: 0.4rem;

  @media (max-width: 640px) {
    display: none;
  }
`;

const Tab = styled.button<{ $active: boolean }>`
  flex-shrink: 0;
  border: none;
  background: none;
  padding: 0.8rem 1.4rem;
  font-size: 1.4rem;
  font-weight: 600;
  white-space: nowrap;
  color: ${(props) =>
    props.$active ? "var(--color-brand-700)" : "var(--color-grey-500)"};
  border-bottom: 3px solid
    ${(props) => (props.$active ? "var(--color-brand-600)" : "transparent")};
  min-height: 4rem;

  &:hover {
    color: var(--color-brand-700);
  }
`;

// Mobile only: a native select carries the exact same selection as the
// tabs above -- both are driven by the same selectedCategoryId/onSelect,
// never a second, independent piece of state.
const MobileSelectWrapper = styled.div`
  display: none;

  @media (max-width: 640px) {
    display: block;
  }
`;

// Visually hidden but still reachable by screen readers -- the standard
// clip technique, not `display: none` (which would remove it from the
// accessibility tree too).
const VisuallyHiddenLabel = styled.label`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
`;

interface DocumentCategoryTabsProps {
  categories: WorkerDocumentCategory[];
  selectedCategoryId: number | null;
  onSelectCategory: (categoryId: number) => void;
}

// Tabs/select are generated entirely from the real catalog (already
// ordered by sort_order at the query level -- getWorkerDocumentCategoriesAndTypes
// orders by sort_order, unchanged) -- no category name is ever
// hardcoded here, so a 6th category or a renamed one needs no UI change.
function DocumentCategoryTabs({
  categories,
  selectedCategoryId,
  onSelectCategory,
}: DocumentCategoryTabsProps) {
  return (
    <div>
      <TabList role="tablist" aria-label="Categorías de documentos">
        {categories.map((category) => (
          <Tab
            key={category.id}
            type="button"
            role="tab"
            aria-selected={category.id === selectedCategoryId}
            $active={category.id === selectedCategoryId}
            onClick={() => onSelectCategory(category.id)}
          >
            {category.name}
          </Tab>
        ))}
      </TabList>

      <MobileSelectWrapper>
        <VisuallyHiddenLabel htmlFor="document-category-select">
          Categoría de documentos
        </VisuallyHiddenLabel>
        <Select
          id="document-category-select"
          value={selectedCategoryId ?? ""}
          onChange={(event) => onSelectCategory(Number(event.target.value))}
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>
      </MobileSelectWrapper>
    </div>
  );
}

export default DocumentCategoryTabs;
