import supabase from "./supabase";
import type { Database } from "../types/supabase";

type StateRoleInsert = Database["public"]["Tables"]["state_roles"]["Insert"];
type StateRoleUpdate = Database["public"]["Tables"]["state_roles"]["Update"];

export async function getStateRoles() {
  const { data, error } = await supabase.from("state_roles").select("*");

  if (error) {
    console.error(error);
    throw new Error("Los roles estatales no se pudieron cargar");
  }

  return data;
}

export async function createEditStateRoles(
  newStateRole: Record<string, unknown>,
  id?: number
) {
  if (!newStateRole || typeof newStateRole !== "object")
    throw new Error("Los datos del rol estatal no son válidos");

  let query = supabase.from("state_roles");

  // A) CREATE
  if (!id) query = query.insert([newStateRole as StateRoleInsert]) as never;

  // B) EDIT
  if (id)
    query = query.update({ ...newStateRole } as StateRoleUpdate).eq("id", id) as never;

  const { data, error } = await query.select().single();

  if (error) {
    console.error(error);
    throw new Error("El registro no pudo ser actualizado");
  }

  return data;
}
