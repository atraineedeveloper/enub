import styled from "styled-components";

export const PhotoCard = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.2rem;
  padding: 1.2rem;
  border: 1px solid var(--color-grey-200);
  border-radius: var(--border-radius-md);
  background: linear-gradient(
    145deg,
    var(--color-grey-50),
    color-mix(in oklab, var(--color-grey-0) 80%, var(--color-brand-50))
  );
`;

export const PhotoSection = styled.section`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 0 0 1.6rem;
  margin-bottom: 1.2rem;
  border-bottom: 1px solid var(--color-grey-100);
`;

export const PhotoSectionTitle = styled.p`
  font-size: 1.8rem;
  font-weight: 600;
  color: var(--color-grey-700);
  text-align: center;
`;

export const PhotoError = styled.span`
  font-size: 1.4rem;
  color: var(--color-red-700);
`;

export const PhotoPreview = styled.div`
  width: 10rem;
  height: 10rem;
  border-radius: 50%;
  overflow: hidden;
  border: 2px solid var(--color-grey-200);
  box-shadow: var(--shadow-sm);
  display: grid;
  place-items: center;
  background-color: var(--color-grey-100);
  color: var(--color-grey-500);
  font-size: 1.2rem;
  text-align: center;
  padding: 0.8rem;
`;

export const PhotoImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
`;

export const PhotoActions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.8rem;
  flex-wrap: wrap;
`;

export const PhotoActionButton = styled.button`
  display: inline-grid;
  place-items: center;
  border: 1px solid var(--color-grey-300);
  border-radius: 999px;
  background-color: var(--color-grey-0);
  width: 3.2rem;
  height: 3.2rem;

  &:hover {
    background-color: var(--color-grey-100);
  }

  & svg {
    width: 1.6rem;
    height: 1.6rem;
  }
`;

export const HiddenInput = styled.input`
  display: none;
`;

export const PlazasContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
`;

export const PlazaRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr auto;
  gap: 0.8rem;
  align-items: center;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

export const PlazaActionButton = styled.button`
  width: 3rem;
  height: 3rem;
  border: 1px solid var(--color-grey-300);
  border-radius: 999px;
  background-color: var(--color-grey-0);
  display: grid;
  place-items: center;

  &:hover {
    background-color: var(--color-grey-100);
  }
`;

export const AddPlazaButton = styled.button`
  border: 1px dashed var(--color-grey-400);
  border-radius: var(--border-radius-sm);
  background-color: var(--color-grey-0);
  padding: 0.8rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-size: 1.3rem;
  font-weight: 600;
  width: fit-content;

  &:hover {
    background-color: var(--color-grey-100);
  }
`;

export const AdmissionsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  width: min(56rem, 100%);
  padding: 1rem;
  border: 1px solid var(--color-grey-200);
  border-radius: var(--border-radius-sm);
  background: linear-gradient(
    180deg,
    var(--color-grey-0),
    color-mix(in oklab, var(--color-grey-0) 85%, var(--color-brand-50))
  );
`;

export const AdmissionRow = styled.div`
  display: grid;
  grid-template-columns: 15rem minmax(0, 1fr) auto;
  gap: 0.8rem;
  align-items: center;

  @media (max-width: 900px) {
    grid-template-columns: minmax(0, 1fr) auto;

    & > :first-child {
      grid-column: 1 / -1;
    }
  }
`;

