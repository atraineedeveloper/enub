import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createEditRoles } from "../../services/apiRoles";
import { toast } from "react-hot-toast";

export function useEditRole() {
  const queryClient = useQueryClient();

  const { mutate: editRole, isPending: isEditing } = useMutation({
    mutationFn: ({ newRole, id }: { newRole: any; id: number }) => createEditRoles(newRole, id),
    onSuccess: () => {
      toast.success("El registro se actualizó con éxito");
      queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return { isEditing, editRole };
}
