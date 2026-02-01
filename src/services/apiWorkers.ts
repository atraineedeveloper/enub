import supabase from "./supabase";
import type { Worker } from "../types/entities";

export async function getWorkersFull(): Promise<Worker[]> {
  const { data, error } = await supabase
    .from("workers")
    .select("*, date_of_admissions(*), sustenance_plazas(*)");

  if (error) {
    console.error(error);
    throw new Error("Los trabajadores no pudieron cargarse");
  }

  return data ?? [];
}

export async function getWorkers(): Promise<Worker[]> {
  const { data, error } = await supabase.from("workers").select("*");

  if (error) {
    console.error(error);
    throw new Error("Los trabajadores no pudieron cargarse");
  }

  return data ?? [];
}

export async function createEditWorkers(newWorker: Partial<Worker>, id?: number) {
  const query = id
    ? supabase.from("workers").update({ ...newWorker }).eq("id", id)
    : supabase.from("workers").insert([newWorker]);

  const { data, error } = await query.select().single();

  if (error) {
    console.error(error);
    throw new Error("El registro no pudo ser actualizado");
  }

  return data;
}
