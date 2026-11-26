import supabase from "./supabase";
import { validateGroupIdentity, validateGroupReason, validateGroupVersion, type GroupVersion } from "./groupValidation";
import { groupMutationError } from "./groupErrors";

export async function getGroups() {
  const { data, error } = await supabase.from("groups").select("*, degrees(*)");
  if (error) throw new Error("Los grupos no se pudieron cargar");
  return data;
}

export async function createGroup(newGroup: object) {
  const identity = validateGroupIdentity(newGroup);
  const { data, error } = await supabase.from("groups").insert([identity]);
  if (error) throw groupMutationError(error);
  return data;
}

export async function updateGroup(target: GroupVersion, input: object) {
  const { id, version } = validateGroupVersion(target);
  const identity = validateGroupIdentity(input);
  const { data, error } = await supabase.rpc("update_group", {
    p_id: id, p_version: version, p_year: identity.year_of_admission,
    p_letter: identity.letter, p_degree: identity.degree_id,
  });
  if (error) throw groupMutationError(error);
  return data;
}

async function changeGroupState(action: "archive_group" | "restore_group" | "delete_group", target: GroupVersion, reason: string) {
  const { id, version } = validateGroupVersion(target);
  const args = { p_id: id, p_version: version, p_reason: validateGroupReason(reason) };
  const { data, error } = await supabase.rpc(action, args);
  if (error) throw groupMutationError(error);
  return data;
}

export const archiveGroup = (target: GroupVersion, reason: string) => changeGroupState("archive_group", target, reason);
export const restoreGroup = (target: GroupVersion, reason: string) => changeGroupState("restore_group", target, reason);
export const deleteGroup = (target: GroupVersion, reason: string) => changeGroupState("delete_group", target, reason);

export async function getGroupAudit(id?: number, before?: number, limit = 50) {
  const { data, error } = await supabase.rpc("get_group_audit", {
    p_id: id ?? null, p_before: before ?? null, p_limit: limit,
  });
  if (error) throw groupMutationError(error);
  return data;
}
