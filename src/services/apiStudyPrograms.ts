import supabase from "./supabase";
import type { Database } from "../types/supabase";

type StudyProgramUpdate = Database["public"]["Tables"]["study_programs"]["Update"];

export async function getStudyPrograms() {
  const { data, error } = await supabase
    .from("study_programs")
    .select("*");

  if (error) {
    console.error(error);
    throw new Error("Los planes de estudio no pudieron cargarse");
  }

  return data;
}

export async function editStudyProgram(
  newProgram: StudyProgramUpdate,
  id: number
) {
  if (!newProgram || typeof newProgram !== "object")
    throw new Error("Los datos del plan de estudio no son válidos");
  if (!id) throw new Error("El identificador del plan de estudio es requerido");

  const { data, error } = await supabase
    .from("study_programs")
    .update(newProgram)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error(error);
    throw new Error("No se pudo actualizar el plan de estudio");
  }
  return data;
}
