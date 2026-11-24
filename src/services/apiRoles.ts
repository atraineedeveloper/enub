import supabase from "./supabase";
import type { Database } from "../types/supabase";

type RoleInsert = Database["public"]["Tables"]["roles"]["Insert"];
type RoleUpdate = Database["public"]["Tables"]["roles"]["Update"];

export async function getRoles() {
  const { data, error } = await supabase.from("roles").select("*, workers(*)");

  if (error) {
    console.error(error);
    throw new Error("Los roles no se pudieron cargar");
  }

  return data;
}

export async function createEditRoles(
  newRole: Record<string, unknown>,
  id?: number
) {
  if (!newRole || typeof newRole !== "object")
    throw new Error("Los datos del rol no son válidos");

  const query = id
    ? supabase.from("roles").update({ ...newRole } as RoleUpdate).eq("id", id)
    : supabase.from("roles").insert([newRole as RoleInsert]);

  const { data, error } = await query.select().single();

  if (error) {
    console.error(error);
    throw new Error("El registro no pudo ser actualizado");
  }

  return data;
}
