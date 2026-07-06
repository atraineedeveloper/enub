import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createEditUtilies } from "../../services/apiUtilities";
import { toast } from "react-hot-toast";

interface EditUtilityVariables {
  newUtility: Record<string, unknown>;
  id?: number;
}

export function useEditUtility() {
  const queryClient = useQueryClient();

  // v5 fix: isLoading→isPending; local alias name (`isEditing`) is this
  // hook's own return shape and is unchanged for its one caller.
  const { mutate: editUtility, isPending: isEditing } = useMutation({
    mutationFn: ({ newUtility, id }: EditUtilityVariables) =>
      createEditUtilies(newUtility, id),
    onSuccess: () => {
      toast.success("El registro se actualizó con éxito");
      queryClient.invalidateQueries({ queryKey: ["utilities"] });
    },
    onError: (err) => toast.error(err.message),
  });

  return { isEditing, editUtility };
}
