import { useContext } from "react";
import { ModalContext } from "./ModalContext";

// Exposed so a consumer nested inside a <Modal.Window> (e.g. a drawer's
// own Escape handler) can tell whether a modal window is currently on top
// of it -- `openName` is non-empty exactly when some Modal.Window is open
// -- and so a consumer can open/close a named window programmatically,
// without needing a literal clickable trigger element (Modal.Open assumes
// one; this doesn't).
export function useModal() {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error("useModal must be used within a <Modal> provider");
  }
  return context;
}
