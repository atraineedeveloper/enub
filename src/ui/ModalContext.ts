import { createContext } from "react";

export interface ModalContextValue {
  openName: string;
  close: () => void;
  open: (name: string) => void;
}

// Split out of Modal.tsx so useModal.ts can import it without that file
// (or Modal.tsx itself) exporting anything other than components --
// exporting a hook alongside a component from the same file is what
// triggered the react-refresh/only-export-components lint warning.
export const ModalContext = createContext<ModalContextValue | undefined>(
  undefined
);
