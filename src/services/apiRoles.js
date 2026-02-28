import supabase from "./supabase";

export async function getRoles() {
  const { data, error } = await supabase.from("roles").select("*, workers(*)");

  if (error) {
    console.error(error);
    throw new Error("Los roles no se pudieron cargar");
  }

  return data;
}

export async function createEditRoles(newRole, id) {
  if (!newRole || typeof newRole !== "object")
    throw new Error("Los datos del rol no son válidos");

  let query = supabase.from("roles");

  // A) CREATE
  if (!id) query = query.insert([newRole]);

  // B) EDIT
  if (id) query = query.update({ ...newRole }).eq("id", id);

  const { data, error } = await query.select().single();

  if (error) {
    console.error(error);
    throw new Error("El registro no pudo ser actualizado");
  }

  return data;
}
