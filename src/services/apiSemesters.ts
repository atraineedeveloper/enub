import supabase from "./supabase";
import type { Semester } from "../types/entities";

export async function getSemesters(): Promise<Semester[]> {
  const { data, error } = await supabase.from("semesters").select("*");

  if (error) {
    console.error(error);
    throw new Error("Los semestres no se pudieron cargar");
  }

  return data ?? [];
}

export async function createSemester(newSemester: Partial<Semester>) {
  const { data, error } = await supabase
    .from("semesters")
    .insert([newSemester]);

  if (error) {
    console.error(error);
    throw new Error("Hubo un error al crear el registro");
  }

  return data;
}
