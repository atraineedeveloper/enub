import supabase from "./supabase";

export async function getUtilies() {
  const { data, error } = await supabase.from("utilities").select("*");

  if (error) {
    console.error(error);
    throw new Error("Los registros no pudieron cargarse");
  }

  return data;
}

export async function createEditUtilies(newUtily: any, id?: number) {
  // 1. Create/edit State Role
  let query: any = supabase.from("utilities");

  // A) CREATE
  if (!id) query = query.insert([newUtily]);

  // B) EDIT
  if (id) query = query.update({ ...newUtily }).eq("id", id);

  const { data, error } = await query.select().single();

  if (error) {
    console.error(error);
    throw new Error("El registro no pudo ser actualizado");
  }

  return data;
}
