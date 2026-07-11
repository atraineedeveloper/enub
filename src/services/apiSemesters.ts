import supabase from "./supabase";
import type { Database } from "../types/supabase";
import {
  findLatestSemester,
  formatSemesterCode,
  getNextSemester,
  getSchoolYearForSemester,
  parseSemesterCode,
} from "../features/semesters/nextSemesterCode";

type SemesterInsert = Database["public"]["Tables"]["semesters"]["Insert"];

// No index signature: the only current caller (CreateSemesterForm.tsx)
// passes react-hook-form's raw `data: object` straight through with no cast,
// and a bare `object` type doesn't satisfy an index-signature requirement.
interface NewSemesterInput {
  semester?: string;
  school_year?: string;
}

export async function getSemesters() {
  const { data, error } = await supabase.from("semesters").select("*");

  if (error) {
    console.error(error);
    throw new Error("Los semestres no se pudieron cargar");
  }

  return data;
}

export async function createSemester(newSemester: NewSemesterInput) {
  if (!newSemester?.semester?.trim())
    throw new Error("El semestre es requerido");
  if (!newSemester?.school_year?.trim())
    throw new Error("El ciclo escolar es requerido");

  // Parsed and validated before any other check (including the bootstrap
  // path, which has no "latest" to compare against) -- a malformed code
  // like "garbage" must never reach the insert, regardless of caller.
  const candidateParsed = parseSemesterCode(newSemester.semester);
  if (!candidateParsed) {
    throw new Error(
      `El formato del semestre "${newSemester.semester}" no es válido. Use el formato AAB, por ejemplo 26A.`
    );
  }

  const candidateCode = formatSemesterCode(candidateParsed);
  // Authoritative: computed from the parsed semester, not trusted from the
  // caller -- a direct/stale/manipulated call cannot submit a mismatched
  // school_year for an otherwise-valid semester code.
  const authoritativeSchoolYear = getSchoolYearForSemester(candidateParsed);
  const normalizedCandidateRaw = newSemester.semester.trim().toUpperCase();

  const existingSemesters = await getSemesters();

  const isDuplicate = existingSemesters.some((s) => {
    // Compare by parsed (canonical) identity when the existing value
    // parses, so "26A" and "2026-A" are recognized as the same semester
    // even though they're different strings. Fall back to a raw
    // normalized-string comparison only for existing rows whose value
    // doesn't parse at all (legacy/malformed data with no canonical form
    // to compare against).
    const existingParsed = parseSemesterCode(s.semester);
    return existingParsed
      ? formatSemesterCode(existingParsed) === candidateCode
      : s.semester?.trim().toUpperCase() === normalizedCandidateRaw;
  });
  if (isDuplicate) {
    throw new Error("Ya existe un semestre con ese código.");
  }

  const latest = findLatestSemester(existingSemesters);
  if (latest) {
    const expectedNext = formatSemesterCode(getNextSemester(latest));
    if (candidateCode !== expectedNext) {
      throw new Error(
        `El siguiente semestre debe ser ${expectedNext}. No se pueden omitir semestres ni registrar semestres anteriores.`
      );
    }
  }

  const { data, error } = await supabase.from("semesters").insert([
    {
      semester: candidateCode,
      school_year: authoritativeSchoolYear,
    } as SemesterInsert,
  ]);

  if (error) {
    console.error(error);
    throw new Error("Hubo un error al crear el registro");
  }

  return data;
}
