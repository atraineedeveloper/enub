import { useMutation, useQueryClient } from "@tanstack/react-query";
import { login as loginApi } from "../../services/apiAuth";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

interface LoginParams {
  email: string;
  password: string;
}

export function useLogin() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { mutate: login, isPending: isLoading, error } = useMutation({
    mutationFn: ({ email, password }: LoginParams) => loginApi({ email, password }),
    onSuccess: (user: any) => {
      queryClient.setQueryData(["user"], user.user);
      navigate("/dashboard", { replace: true });
    },
    onError: (err: unknown) => {
      console.log(err);

      toast.error("El correo o contraseña son incorrectos");
    },
  });

  return { login, isLoading, error };
}
