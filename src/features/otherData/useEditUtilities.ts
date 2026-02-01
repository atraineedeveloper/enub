import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createEditUtilies } from "../../services/apiUtilities";
import { toast } from "react-hot-toast";

export function useEditUtility() {
  const queryClient = useQueryClient();

  const { mutate: editUtility, isPending: isEditing } = useMutation({
    mutationFn: ({ newUtility, id }: { newUtility: any; id: number }) =>
      createEditUtilies(newUtility, id),
    onSuccess: () => {
      toast.success("El registro se actualizó con éxito");
      queryClient.invalidateQueries({ queryKey: ["utilities"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return { isEditing, editUtility };
}
