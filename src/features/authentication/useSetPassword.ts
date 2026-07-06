import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { updateUserPassword } from "../../services/apiAuth";

export function useSetPassword() {
  const navigate = useNavigate();

  const { mutate: setPassword, isPending: isSettingPassword } = useMutation({
    mutationFn: updateUserPassword,
    onSuccess: () => {
      toast.success("Contraseña establecida con éxito");
      navigate("/my-documents", { replace: true });
    },
    onError: (err) => toast.error(err.message),
  });

  return { setPassword, isSettingPassword };
}
