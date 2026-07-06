import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createEditStateRoles } from "../../services/apiStateRoles";
import { toast } from "react-hot-toast";

interface EditStateRoleVariables {
  newStateRole: Record<string, unknown>;
  id?: number;
}

export function useEditStateRole() {
  const queryClient = useQueryClient();

  // v5 fix: isLoading→isPending; local alias name (`isEditing`) is this
  // hook's own return shape and is unchanged for its one caller.
  const { mutate: editStateRole, isPending: isEditing } = useMutation({
    mutationFn: ({ newStateRole, id }: EditStateRoleVariables) =>
      createEditStateRoles(newStateRole, id),
    onSuccess: () => {
      toast.success("El registro se actualizó con éxito");
      queryClient.invalidateQueries({ queryKey: ["stateRoles"] });
    },
    onError: (err) => toast.error(err.message),
  });

  return { isEditing, editStateRole };
}
