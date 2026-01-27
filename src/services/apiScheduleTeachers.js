import supabase from "./supabase";

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

export async function createEditScheduleTeachers(newScheduleTeachers, id) {
  let query = supabase.from("schedule_teachers");

  // A) CREATE
  if (!id) query = query.insert([newScheduleTeachers]);

  // B) EDIT
  if (id) query = query.update({ ...newScheduleTeachers }).eq("id", id);

  const { data, error } = await query.select();

  if (error) {
    console.error(error);
    throw new Error("Hubo un error al guardar el registro");
  }

  return data?.[0];
}

export async function deleteScheduleTeachers(id) {
  const { data, error } = await supabase
    .from("schedule_teachers")
    .delete()
    .eq("id", id);

  if (error) {
    console.error(error);
    throw new Error("Hubo un error al eleminar el registro");
  }

  return data;
}
