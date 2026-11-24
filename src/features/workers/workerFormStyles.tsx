import styled from "styled-components";
import { cloneElement, isValidElement, useId, type ReactNode } from "react";

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


export const WorkerForm = styled.form`
  display: flex; flex-direction: column; min-height: 0;
  width: 100%; height: min(76rem, 88dvh);
  color: var(--color-grey-800); font-size: 1.4rem;
  @media (max-width: 640px) { height: 94dvh; }
`;
export const FormHeader = styled.header`
  padding: 2.4rem 6rem 2rem 2.8rem;
  border-bottom: 1px solid var(--color-grey-200);
  span { font-size: 1.05rem; letter-spacing: .15em; font-weight: 700; color: var(--color-brand-700); }
  h2 { font-size: 2.5rem; line-height: 1.2; margin: .5rem 0; letter-spacing: -.04em; }
  p { color: var(--color-grey-500); overflow-wrap: anywhere; }
  @media(max-width: 640px) { padding: 1.5rem 5rem 1.3rem 1.6rem; h2 { font-size: 2rem; } }
`;
export const FormWorkspace = styled.div`
  flex: 1; min-height: 0; display: grid; grid-template-columns: 24rem minmax(0,1fr); overflow: hidden;
  @media(max-width: 760px) { display: flex; flex-direction: column; }
`;
export const SectionNav = styled.nav`
  background: var(--color-grey-50); padding: 1.8rem 1.2rem;
  border-right: 1px solid var(--color-grey-200); display: flex; flex-direction: column; gap: .7rem;
  @media(max-width:760px) { flex-direction: row; overflow-x: auto; border-right: 0; border-bottom: 1px solid var(--color-grey-200); padding: .8rem; flex-shrink: 0; }
`;
export const SectionButton = styled.button<{ $active: boolean }>`
  display: flex; align-items: center; gap: 1rem; text-align: left;
  background: ${p => p.$active ? "var(--color-brand-50)" : "transparent"};
  border: 1px solid ${p => p.$active ? "var(--color-brand-200)" : "transparent"};
  border-radius: 1rem; padding: 1.15rem; color: var(--color-grey-800);
  &:hover { background: var(--color-grey-100); }
  .step-number { flex-shrink: 0; display: grid; place-items: center; width: 3rem; height: 3rem; border-radius: .8rem; font-weight: 700; background: ${p => p.$active ? "var(--color-brand-600)" : "var(--color-grey-200)"}; color: ${p => p.$active ? "var(--color-brand-50)" : "var(--color-grey-700)"}; }
  .step-text { display: grid; gap: .3rem; min-width: 0; }
  strong { font-size: 1.3rem; font-weight: 650; }
  small { font-size: 1.1rem; color: var(--color-grey-500); line-height: 1.3; }
  .step-error { color: var(--color-red-700); font-weight: 800; margin-left: auto; }
  @media(max-width:760px) { flex-shrink: 0; padding: .7rem; small { display: none; } strong { font-size: 1.2rem; } .step-number { width: 2.4rem; height: 2.4rem; } }
`;
export const FormBody = styled.div`
  min-width: 0; min-height: 0; overflow-y: auto; padding: 2.8rem;
  @media(max-width:640px) { padding: 1.6rem; }
`;
export const FormSection = styled.section`
  &[hidden] { display: none; }
`;
export const SectionHeading = styled.div`
  margin-bottom: 2.2rem;
  h3 { font-size: 2rem; letter-spacing: -.025em; font-weight: 650; }
  p { color: var(--color-grey-500); margin-top: .5rem; line-height: 1.5; }
`;
export const FieldGrid = styled.div`
  display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 1.8rem;
  & > section { grid-column: 1 / -1; }
  @media(max-width:640px) { grid-template-columns: minmax(0,1fr); gap: 1.4rem; }
`;
const Field = styled.div<{ $wide: boolean }>`
  min-width: 0; display: flex; flex-direction: column; gap: .65rem;
  grid-column: ${p => p.$wide ? "1 / -1" : "auto"};
  label { font-size: 1.3rem; font-weight: 600; }
  input:not([type="hidden"]), select, textarea { width: 100%; min-width: 0; border-radius: .8rem; min-height: 4.3rem; }
  textarea { min-height: 9rem; resize: vertical; }
  [aria-invalid="true"] { border-color: var(--color-red-700); }
  .field-error { color: var(--color-red-700); font-size: 1.2rem; }
`;
export function WorkerFormField({ label, error, alignTop, children }: { label?: string; error?: string; alignTop?: boolean; children: ReactNode }) {
  const errorId = useId();
  const child = isValidElement<{ id?: string; "aria-invalid"?: boolean; "aria-describedby"?: string }>(children) ? children : null;
  const id = child?.props.id;
  const wide = Boolean(alignTop || id === "name" || id === "function_performed" || id === "observations" || id === "street");
  return <Field $wide={wide}>
    {label && (id ? <label htmlFor={id}>{label}</label> : <span style={{fontWeight: 600}}>{label}</span>)}
    {child && id ? cloneElement(child, { "aria-invalid": Boolean(error), "aria-describedby": error ? errorId : undefined }) : children}
    {error && <span className="field-error" id={errorId} role="alert">{error}</span>}
  </Field>;
}
export const FormFooter = styled.footer`
  flex-shrink: 0; padding: 1.6rem 2.4rem; border-top: 1px solid var(--color-grey-200);
  display: flex; gap: 1rem; justify-content: space-between; align-items: center;
  background: var(--color-grey-0);
  > span { font-size: 1.2rem; color: var(--color-grey-500); white-space: nowrap; }
  @media(max-width:640px) { padding: 1rem 1.2rem; flex-wrap: wrap; }
`;
export const FooterActions = styled.div`
  display: flex; flex-wrap: wrap; gap: .8rem; justify-content: flex-end;
  @media(max-width:640px) { width: 100%; justify-content: stretch; button { flex: 1; padding: 1rem; } }
`;
