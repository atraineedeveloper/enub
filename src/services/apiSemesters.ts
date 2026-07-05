import supabase from "./supabase";
import type { Database } from "../types/supabase";

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

  const { data, error } = await supabase
    .from("semesters")
    .insert([newSemester as SemesterInsert]);

  if (error) {
    console.error(error);
    throw new Error("Hubo un error al crear el registro");
  }

  return data;
}
