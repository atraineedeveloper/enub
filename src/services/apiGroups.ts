import supabase from "./supabase";
import type { Database } from "../types/supabase";

type GroupInsert = Database["public"]["Tables"]["groups"]["Insert"];

export async function getGroups() {
  const { data, error } = await supabase.from("groups").select("*, degrees(*)");

  if (error) {
    console.error(error);
    throw new Error("Los grupos no se pudieron cargar");
  }

  return data;
}

// Typed as `object` (not `Record<string, unknown>`) because the only current
// caller (CreateGroupForm.tsx) passes react-hook-form's raw `data: object`
// straight through with no cast; `Record<string, unknown>`'s index signature
// isn't satisfied by that bare `object` type at the call site.
export async function createGroup(newGroup: object) {
  if (!newGroup || typeof newGroup !== "object")
    throw new Error("Los datos del grupo no son válidos");

  const { data, error } = await supabase
    .from("groups")
    .insert([newGroup as GroupInsert]);

  if (error) {
    console.error(error);
    throw new Error("Hubo un error al crear el registro");
  }

  return data;
}
