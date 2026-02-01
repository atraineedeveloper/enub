import supabase from "./supabase";
import type { ScheduleTeacher } from "../types/entities";

type NewScheduleTeacher = Omit<
  ScheduleTeacher,
  "id" | "workers" | "semesters"
>;

export async function getScheduleTeachers(): Promise<ScheduleTeacher[]> {
  const { data, error } = await supabase
    .from("schedule_teachers")
    .select("*, workers(*), semesters(*)");

  if (error) {
    console.error(error);
    throw new Error("Los horarios no se pudieron cargar");
  }

  return data ?? [];
}

export async function createEditScheduleTeachers(
  newScheduleTeachers: Partial<NewScheduleTeacher>,
  id?: number
) {
  const query = id
    ? supabase
        .from("schedule_teachers")
        .update({ ...newScheduleTeachers })
        .eq("id", id)
    : supabase.from("schedule_teachers").insert([newScheduleTeachers]);

  const { data, error } = await query.select();

  if (error) {
    console.error(error);
    throw new Error("Hubo un error al guardar el registro");
  }

  return data?.[0] as ScheduleTeacher | undefined;
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
