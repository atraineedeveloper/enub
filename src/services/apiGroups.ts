import supabase from "./supabase";
import type { Group } from "../types/entities";

export async function getGroups(): Promise<Group[]> {
  const { data, error } = await supabase.from("groups").select("*, degrees(*)");

  if (error) {
    console.error(error);
    throw new Error("Los grupos no se pudieron cargar");
  }

  return data ?? [];
}

export async function createGroup(newGroup: Partial<Group>) {
  const { data, error } = await supabase.from("groups").insert([newGroup]);

  if (error) {
    console.error(error);
    throw new Error("Hubo un error al crear el registro");
  }

  return data;
}
