import supabase from "./supabase";

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

export async function createScheduleAssignments(newScheduleAssignment) {
  const { data, error } = await supabase
    .from("schedule_assignments")
    .insert([newScheduleAssignment]);

  if (error) {
    console.error(error);
    throw new Error("Hubo un error al crear el registro");
  }

  return data;
}

export async function createEditScheduleAssignments(newScheduleAssignment, id) {
  // 1. Create/edit State Role
  let query = supabase.from("schedule_assignments");

  // A) CREATE
  if (!id) query = query.insert([newScheduleAssignment]);

  // B) EDIT
  if (id) query = query.update({ ...newScheduleAssignment }).eq("id", id);

  const { data, error } = await query.select().single();

  if (error) {
    console.error(error);
    throw new Error("El registro no pudo ser actualizado");
  }

  return data;
}

export async function deleteScheduleAssignment(id) {
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
