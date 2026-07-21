// Small, pure display-formatting helpers shared by the worker-document
// card components -- kept separate from any component so each is unit
// testable without rendering anything.

export function formatWorkerDocumentDate(value?: string | null): string {
  if (!value) return "";

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function getWorkerDocumentFileExtension(fileName = ""): string {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts.pop()!.toUpperCase() : "";
}

const FILE_SIZE_UNITS = ["B", "KB", "MB", "GB"] as const;

// null/undefined/zero/negative all mean "unknown size" -- returns "" so
// callers can simply omit it from a joined meta line rather than showing
// something like "0 B" or "NaN B" for missing data.
export function formatWorkerDocumentFileSize(
  bytes?: number | null
): string {
  if (!bytes || bytes <= 0) return "";

  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < FILE_SIZE_UNITS.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const decimals = unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(decimals)} ${FILE_SIZE_UNITS[unitIndex]}`;
}
