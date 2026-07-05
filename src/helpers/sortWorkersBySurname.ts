const SURNAME_PARTICLES = new Set([
  "da",
  "de",
  "del",
  "do",
  "dos",
  "la",
  "las",
  "los",
  "mac",
  "mc",
  "van",
  "von",
]);

const collator = new Intl.Collator("es-MX", {
  sensitivity: "base",
  numeric: true,
});

function getSurnameSortKey(fullName: string = "") {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length <= 1) return parts[0] ?? "";
  if (parts.length === 2) return parts[1];

  let surnameStart = parts.length - 2;

  while (
    surnameStart > 0 &&
    SURNAME_PARTICLES.has(parts[surnameStart - 1].toLowerCase())
  ) {
    surnameStart -= 1;
  }

  return parts.slice(surnameStart).join(" ");
}

// Generic so the return type mirrors whatever caller-specific worker shape
// (e.g. Worker[], WorkerWithDetails[]) is passed in -- this helper only ever
// reads `.name`.
interface WorkerWithName {
  name?: string | null;
}

function sortWorkersBySurname<T extends WorkerWithName>(workers: T[] = []): T[] {
  return [...workers].sort((leftWorker, rightWorker) => {
    const leftSurname = getSurnameSortKey(leftWorker?.name ?? "");
    const rightSurname = getSurnameSortKey(rightWorker?.name ?? "");

    const surnameComparison = collator.compare(leftSurname, rightSurname);
    if (surnameComparison !== 0) return surnameComparison;

    return collator.compare(leftWorker?.name ?? "", rightWorker?.name ?? "");
  });
}

export default sortWorkersBySurname;
