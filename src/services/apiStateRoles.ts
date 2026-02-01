import supabase from "./supabase";

export async function getStateRoles() {
  const { data, error } = await supabase.from("state_roles").select("*");

  if (error) {
    console.error(error);
    throw new Error("Los roles estatales no se pudieron cargar");
  }

  return data;
}

export async function createEditStateRoles(newStateRole: any, id?: number) {
  // 1. Create/edit State Role
  let query: any = supabase.from("state_roles");

  // A) CREATE
  if (!id) query = query.insert([newStateRole]);

  // B) EDIT
  if (id) query = query.update({ ...newStateRole }).eq("id", id);

  const { data, error } = await query.select().single();

  if (error) {
    console.error(error);
    throw new Error("El registro no pudo ser actualizado");
  }

  return data;
}
