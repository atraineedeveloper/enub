import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createEditRoles } from "../../services/apiRoles";
import { toast } from "react-hot-toast";
import type { Role } from "./useRoles";

interface EditRoleVariables {
  newRole: Partial<Role>;
  id: number;
}

export function useEditRole() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ newRole, id }: EditRoleVariables) =>
      createEditRoles(newRole, id),
    onSuccess: () => {
      toast.success("El registro se actualizó con éxito");
      queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
    onError: (err) => toast.error(err.message),
  });
  const { mutate: editRole } = mutation;
  // TanStack Query v5's useMutation has no `isLoading` (only `isPending`) —
  // this was already always `undefined` at runtime before this file had any
  // type checking at all. Preserved exactly, not fixed — see design.md.
  const isEditing = (mutation as unknown as { isLoading?: boolean }).isLoading;

  return { isEditing, editRole };
}
