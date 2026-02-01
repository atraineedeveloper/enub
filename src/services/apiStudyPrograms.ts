import supabase from "./supabase";

export async function getStudyPrograms() {
  const { data, error } = await supabase
    .from("study_programs")
    .select("*");

  if (error) {
    console.error(error);
    throw new Error("Los planes de estudio no pudieron cargarse");
  }

  return data;
}

export async function editStudyProgram(newProgram: any, id: number) {
  const { data, error } = await supabase
    .from("study_programs")
    .update(newProgram)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error(error);
    throw new Error("No se pudo actualizar el plan de estudio");
  }
  return data;
}
