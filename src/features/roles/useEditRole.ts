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

  const { mutate: editRole, isPending: isEditing } = useMutation({
    mutationFn: ({ newRole, id }: EditRoleVariables) =>
      createEditRoles(newRole, id),
    onSuccess: () => {
      toast.success("El registro se actualizó con éxito");
      queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
    onError: (err) => toast.error(err.message),
  });

  return { isEditing, editRole };
}
