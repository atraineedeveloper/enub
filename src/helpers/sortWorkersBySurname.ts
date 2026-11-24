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
  return workers.map((worker) => ({
    worker,
    name: worker?.name ?? "",
    surname: getSurnameSortKey(worker?.name ?? ""),
  })).sort((left, right) =>
    collator.compare(left.surname, right.surname) || collator.compare(left.name, right.name)
  ).map(({ worker }) => worker);
}

export default sortWorkersBySurname;
