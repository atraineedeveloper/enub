import {
  HiOutlineDocument,
  HiOutlineDocumentText,
  HiOutlinePhoto,
  HiOutlineTableCells,
} from "react-icons/hi2";
import { getWorkerDocumentFileExtension } from "../workerDocumentDisplay";

const IMAGE_EXTENSIONS = new Set(["JPG", "JPEG", "PNG", "WEBP"]);
const SPREADSHEET_EXTENSIONS = new Set(["XLS", "XLSX"]);
const TEXT_DOCUMENT_EXTENSIONS = new Set(["PDF", "DOC", "DOCX"]);

interface FileTypeIconProps {
  fileName: string;
}

// A small, purely decorative icon keyed off the file extension -- never
// the sole means of conveying file type (the extension is always also
// shown as text alongside it), so it carries aria-hidden.
function FileTypeIcon({ fileName }: FileTypeIconProps) {
  const extension = getWorkerDocumentFileExtension(fileName);

  if (TEXT_DOCUMENT_EXTENSIONS.has(extension)) {
    return <HiOutlineDocumentText aria-hidden="true" />;
  }

  if (SPREADSHEET_EXTENSIONS.has(extension)) {
    return <HiOutlineTableCells aria-hidden="true" />;
  }

  if (IMAGE_EXTENSIONS.has(extension)) {
    return <HiOutlinePhoto aria-hidden="true" />;
  }

  return <HiOutlineDocument aria-hidden="true" />;
}

export default FileTypeIcon;
