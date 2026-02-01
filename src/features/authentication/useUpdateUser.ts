import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateCurrentUser } from "../../services/apiAuth";
import toast from "react-hot-toast";

interface UpdateUserPayload {
  fullName?: string;
  password?: string;
  avatar?: File | null;
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  const { mutate, isPending: isLoading } = useMutation({
    mutationFn: updateCurrentUser,
    onSuccess: ({ user }) => {
      toast.success("El usuario se actualizó con éxito");
      queryClient.setQueryData(["user"], user);
    },
    onError: (err: unknown) => toast.error("Error al actualizar usuario"),
  });

  return { updateUser: mutate, isLoading };
}
