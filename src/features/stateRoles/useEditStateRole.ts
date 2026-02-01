import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createEditStateRoles } from "../../services/apiStateRoles";
import { toast } from "react-hot-toast";

export function useEditStateRole() {
  const queryClient = useQueryClient();

  const { mutate: editStateRole, isPending: isEditing } = useMutation({
    mutationFn: ({ newStateRole, id }: { newStateRole: any; id: number }) =>
      createEditStateRoles(newStateRole, id),
    onSuccess: () => {
      toast.success("El registro se actualizó con éxito");
      queryClient.invalidateQueries({ queryKey: ["stateRoles"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return { isEditing, editStateRole };
}
