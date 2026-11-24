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

  const query = id
    ? supabase.from("state_roles").update({ ...newStateRole } as StateRoleUpdate).eq("id", id)
    : supabase.from("state_roles").insert([newStateRole as StateRoleInsert]);

  const { data, error } = await query.select().single();

  if (error) {
    console.error(error);
    throw new Error("El registro no pudo ser actualizado");
  }

  return data;
}
