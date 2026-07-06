import supabase from "./supabase";
import type { Database } from "../types/supabase";

type ScheduleAssignmentInsert =
  Database["public"]["Tables"]["schedule_assignments"]["Insert"];
type ScheduleAssignmentUpdate =
  Database["public"]["Tables"]["schedule_assignments"]["Update"];

export async function getScheduleAssignments() {
  const { data, error } = await supabase
    .from("schedule_assignments")
    .select(
      "*, workers(id, name), subjects(id, name), groups(id, year_of_admission, letter, degrees(id, code, name)), semesters(id, school_year)"
    );

  if (error) {
    console.error(error);
    throw new Error("Los horarios no se pudieron cargar");
  }

  return data;
}

export async function createScheduleAssignments(
  newScheduleAssignment: Record<string, unknown>
) {
  const { data, error } = await supabase
    .from("schedule_assignments")
    .insert([newScheduleAssignment as ScheduleAssignmentInsert]);

  if (error) {
    console.error(error);
    throw new Error("Hubo un error al crear el registro");
  }

  return data;
}

export async function createEditScheduleAssignments(
  newScheduleAssignment: Record<string, unknown>,
  id?: number
) {
  if (!newScheduleAssignment || typeof newScheduleAssignment !== "object")
    throw new Error("Los datos del horario no son válidos");
  if (!newScheduleAssignment.worker_id)
    throw new Error("El trabajador del horario es requerido");
  if (!id && !newScheduleAssignment.semester_id)
    throw new Error("El semestre del horario es requerido");

  let query = supabase.from("schedule_assignments");

  // A) CREATE
  if (!id)
    query = query.insert([
      newScheduleAssignment as ScheduleAssignmentInsert,
    ]) as never;

  // B) EDIT
  if (id)
    query = query
      .update({ ...newScheduleAssignment } as ScheduleAssignmentUpdate)
      .eq("id", id) as never;

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
