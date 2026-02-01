import supabase from "./supabase";
import type { ScheduleAssignment } from "../types/entities";

type NewScheduleAssignment = Omit<
  ScheduleAssignment,
  "id" | "workers" | "subjects" | "groups" | "semesters"
>;

export async function getScheduleAssignments(): Promise<ScheduleAssignment[]> {
  const { data, error } = await supabase
    .from("schedule_assignments")
    .select(
      "*, workers(id, name), subjects(id, name), groups(id, year_of_admission, letter, degrees(id, code, name)), semesters(id, school_year)"
    );

  if (error) {
    console.error(error);
    throw new Error("Los horarios no se pudieron cargar");
  }

  return data ?? [];
}

export async function createScheduleAssignments(
  newScheduleAssignment: NewScheduleAssignment
) {
  const { data, error } = await supabase
    .from("schedule_assignments")
    .insert([newScheduleAssignment]);

  if (error) {
    console.error(error);
    throw new Error("Hubo un error al crear el registro");
  }

  return data;
}

export async function createEditScheduleAssignments(
  newScheduleAssignment: Partial<NewScheduleAssignment>,
  id?: number
) {
  const query = id
    ? supabase
        .from("schedule_assignments")
        .update({ ...newScheduleAssignment })
        .eq("id", id)
    : supabase.from("schedule_assignments").insert([newScheduleAssignment]);

  const { data, error } = await query.select().single();

  if (error) {
    console.error(error);
    throw new Error("El registro no pudo ser actualizado");
  }

  return data;
}

export async function deleteScheduleAssignment(id: number) {
  const { data, error } = await supabase
    .from("schedule_assignments")
    .delete()
    .eq("id", id);

  if (error) {
    console.error(error);
    throw new Error("Hubo un error al eleminar el registro");
  }

  return data;
}
