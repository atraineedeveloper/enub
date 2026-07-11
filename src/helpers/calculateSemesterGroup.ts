// entryYear is widened to `number | null | undefined` to match callers'
// actual `year_of_admission: number | null` field (some accessed via
// optional chaining, adding `undefined`) without requiring changes at those
// call sites; the non-null assertions below preserve the original's exact
// runtime behavior (null/undefined coerce the same way in
// `new Date(null, ...)` whether asserted away for TS or not) rather than
// adding new guards.
function calculateSemesterGroup(entryYear: number | null | undefined): number {
  // Semestres administrativos:
  // - Semestres PARES inician el 23 de Enero.
  // - Semestres IMPARES inician el 1 de Agosto.

  // Asumimos que la generación ingresó el 1 de Agosto del entryYear.
  // (Si ingresó en agosto, ese día comienza semestre 1).

  const now = new Date();

  // Fecha de referencia inicial: 1 de Agosto del año de ingreso
  const startDate = new Date(entryYear!, 7, 1); // Mes 7 = Agosto, Dia 1

  // Calculamos diferencia en milisegundos
  const diffTime = now.getTime() - startDate.getTime();

  // Si la fecha actual es anterior a la fecha de ingreso, retornamos 1
  if (diffTime < 0) return 1;

  let grade = 1;
  let checkDate = new Date(entryYear!, 7, 1); // Inicio Semestre 1 (1 Ago)

  // Mientras la fecha actual sea mayor o igual al inicio del SIGUIENTE semestre, incrementamos
  while (true) {
    // Calcular inicio del siguiente semestre
    let nextSemesterDate;

    if (checkDate.getMonth() === 7) {
      // Si estamos en Agosto (Impar), el siguiente es 23 de Enero del próximo año (Par)
      nextSemesterDate = new Date(checkDate.getFullYear() + 1, 0, 23);
    } else {
      // Si estamos en Enero (Par), el siguiente es 1 de Agosto del mismo año (Impar)
      nextSemesterDate = new Date(checkDate.getFullYear(), 7, 1);
    }

    if (now >= nextSemesterDate) {
      grade++;
      checkDate = nextSemesterDate;
    } else {
      break;
    }
  }

  return grade;
}

const SEMESTER_CODE_PATTERN = /^(\d{2}|\d{4})-?([AB])$/i;

/**
 * Calculates a group's grade relative to a selected semester code (e.g.
 * "26A", "2026-A") instead of today's date. Falls back to
 * calculateSemesterGroup(entryYear) -- today's-date-based -- for
 * unparseable/unknown semester codes, logging a warning since that is
 * degraded behavior for legacy/unknown data, not the normal path.
 *
 * Deliberately NOT floored at 1: a group's cohort has not started yet in
 * any semester before its entry term, and the resulting grade (0 or
 * negative) is the signal callers use to exclude it from
 * active-group visibility (see ScheduleDashboard.tsx's `currentGroups`
 * filter, which requires `grade >= 1`). Clamping here would hide that
 * signal and let not-yet-started groups appear as a false "1°".
 */
export function calculateSemesterGroupForSemester(
  entryYear: number | null | undefined,
  semesterCode: string | null | undefined
): number {
  const match = semesterCode?.trim().toUpperCase().match(SEMESTER_CODE_PATTERN);

  if (!match) {
    console.warn(
      `calculateSemesterGroupForSemester: no se pudo interpretar el semestre "${semesterCode}", usando el cálculo por fecha actual`
    );
    return calculateSemesterGroup(entryYear);
  }

  const rawYear = match[1];
  const letter = match[2].toUpperCase();
  const targetYear = rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear);

  const termIndex = (year: number, term: string) => year * 2 + (term === "A" ? 0 : 1);

  const entryIndex = termIndex(entryYear!, "B");
  const targetIndex = termIndex(targetYear, letter);

  return targetIndex - entryIndex + 1;
}

export default calculateSemesterGroup;
