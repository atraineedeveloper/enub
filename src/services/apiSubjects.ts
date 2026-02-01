import supabase from "./supabase";
import type { Subject } from "../types/entities";

export async function getSubjects(): Promise<Subject[]> {
  const { data, error } = await supabase
    .from("subjects")
    .select("*, study_programs(*), degrees(*)");

  if (error) {
    console.error(error);
    throw new Error("Las asignaturas no pudieron cargarse");
  }

  return data ?? [];
}
