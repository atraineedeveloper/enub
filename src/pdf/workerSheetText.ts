export function transformDate(dateString: string) {
  const [year, month, day] = dateString.split("-");
  const shortYear = year.slice(-2);

  return `${day}-${month}-${shortYear}`;
}

export function getFileExtension(fileName?: string | null) {
  return fileName?.split(".").pop();
}

export const normalizeMultilineText = (value: unknown) =>
  String(value ?? "")
    .replace(/\n[ \t]+/g, "\n")
    .trim();

export const buildFunctionPerformedText = (
  workerFunctionPerformed: string | null,
  uniqueTeacherSchedule: { name: string; quantity: number }[]
) => {
  const manualFunction = String(workerFunctionPerformed ?? "").trim();
  const activities = (uniqueTeacherSchedule ?? [])
    .filter((item) => item?.name?.trim())
    .map((item) => item.name.trim());

  const merged = [manualFunction, ...activities].filter(Boolean);
  const seen = new Set();
  const deduped = merged.filter((item) => {
    const key = item.toUpperCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return deduped.join("\n\n");
};

