import supabase from "./supabase";

export async function getWorkersFull() {
  const { data, error } = await supabase
    .from("workers")
    .select(
      "*, date_of_admissions(*), sustenance_plazas(*), schedule_teachers(*), schedule_assignments(*, subjects(*), groups(*, degrees(*)))"
    );

  if (error) {
    console.error(error);
    throw new Error("Los trabajadores no pudieron cargarse");
  }

  return data;
}

export async function getWorkers() {
  const { data, error } = await supabase.from("workers").select("*");

  if (error) {
    console.error(error);
    throw new Error("Los trabajadores no pudieron cargarse");
  }

  return data;
}

export async function createEditWorkers(newWorker, id) {
  // 1. Create/edit State Role
  let query = supabase.from("workers");

  // A) CREATE
  if (!id) query = query.insert([newWorker]);

  // B) EDIT
  if (id) query = query.update({ ...newWorker }).eq("id", id);

  const { data, error } = await query.select().single();

  if (error) {
    console.error(error);
    throw new Error("El registro no pudo ser actualizado");
  }

  return data;
}
