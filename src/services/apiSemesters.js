import supabase from "./supabase";

export async function getSemesters() {
  const { data, error } = await supabase.from("semesters").select("*");

  if (error) {
    console.error(error);
    throw new Error("Los semestres no se pudieron cargar");
  }

  return data;
}

export async function createSemester(newSemester) {
  if (!newSemester?.semester?.trim())
    throw new Error("El semestre es requerido");
  if (!newSemester?.school_year?.trim())
    throw new Error("El ciclo escolar es requerido");

  const { data, error } = await supabase
    .from("semesters")
    .insert([newSemester]);

  if (error) {
    console.error(error);
    throw new Error("Hubo un error al crear el registro");
  }

  return data;
}
