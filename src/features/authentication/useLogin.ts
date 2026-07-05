import { useMutation, useQueryClient } from "@tanstack/react-query";
import { login as loginApi } from "../../services/apiAuth";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

interface LoginVariables {
  email: string;
  password: string;
}

export function useLogin() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // v5 fix: useMutation's pending flag is `isPending`, not `isLoading`
  // (`isLoading` doesn't exist on the v5 mutation result at all, so it was
  // always `undefined` -- silently disabling the loading spinner/disabled
  // state in LoginForm). Aliased back to `isLoading` so this hook's own
  // return shape/name is unchanged for its one caller.
  const { mutate: login, isPending: isLoading, error } = useMutation({
    mutationFn: ({ email, password }: LoginVariables) =>
      loginApi({ email, password }),
    onSuccess: (user) => {
      queryClient.setQueryData(["user"], user.user);
      navigate("/dashboard", { replace: true });
    },
    onError: (err: Error) => {
      toast.error("El correo o contraseña son incorrectos");
    },
  });

  return { login, isLoading, error };
}
