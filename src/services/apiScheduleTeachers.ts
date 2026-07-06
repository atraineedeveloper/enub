import supabase from "./supabase";
import type { Database } from "../types/supabase";

type ScheduleTeacherInsert =
  Database["public"]["Tables"]["schedule_teachers"]["Insert"];
type ScheduleTeacherUpdate =
  Database["public"]["Tables"]["schedule_teachers"]["Update"];

export async function getScheduleTeachers() {
  const { data, error } = await supabase
    .from("schedule_teachers")
    .select("*, workers(*), semesters(*)");

  if (error) {
    console.error(error);
    throw new Error("Los horarios no se pudieron cargar");
  }

  return data;
}

export async function createEditScheduleTeachers(
  newScheduleTeachers: Record<string, unknown>,
  id?: number
) {
  if (!newScheduleTeachers || typeof newScheduleTeachers !== "object")
    throw new Error("Los datos del horario del maestro no son válidos");

  let query = supabase.from("schedule_teachers");

  // A) CREATE
  if (!id)
    query = query.insert([
      newScheduleTeachers as ScheduleTeacherInsert,
    ]) as never;

  // B) EDIT
  if (id)
    query = query
      .update({ ...newScheduleTeachers } as ScheduleTeacherUpdate)
      .eq("id", id) as never;

  const { data, error } = await query.select();

  if (error) {
    console.error(error);
    throw new Error("Hubo un error al guardar el registro");
  }

  return data?.[0];
}

export async function deleteScheduleTeachers(id: number) {
  const { data, error } = await supabase
    .from("schedule_teachers")
    .delete()
    .eq("id", id);

  if (error) {
    console.error(error);
    throw new Error("Hubo un error al eliminar el registro");
  }

  return data;
}
