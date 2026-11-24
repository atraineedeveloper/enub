import supabase from "./supabase";
import type { Database } from "../types/supabase";

type UtilityInsert = Database["public"]["Tables"]["utilities"]["Insert"];
type UtilityUpdate = Database["public"]["Tables"]["utilities"]["Update"];

export async function getUtilies() {
  const { data, error } = await supabase.from("utilities").select("*");

  if (error) {
    console.error(error);
    throw new Error("Los registros no pudieron cargarse");
  }

  return data;
}

export async function createEditUtilies(
  newUtily: Record<string, unknown>,
  id?: number
) {
  if (!newUtily || typeof newUtily !== "object")
    throw new Error("Los datos del registro no son válidos");

  const query = id
    ? supabase.from("utilities").update({ ...newUtily } as UtilityUpdate).eq("id", id)
    : supabase.from("utilities").insert([newUtily as UtilityInsert]);

  const { data, error } = await query.select().single();

  if (error) {
    console.error(error);
    throw new Error("El registro no pudo ser actualizado");
  }

  return data;
}
