import { useMutation, useQueryClient } from "@tanstack/react-query";
import { logout as logoutApi } from "../../services/apiAuth";
import { useNavigate } from "react-router-dom";

export function useLogout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // v5 fix: same isLoading→isPending rename as useLogin.ts, aliased back to
  // `isLoading` to keep this hook's return shape unchanged for its callers
  // (AccountPopover.tsx and DirectLogoutButton.tsx; the original single
  // caller, Logout.tsx, was removed when the header was modernized).
  const { mutate: logout, isPending: isLoading } = useMutation({
    mutationFn: logoutApi,
    onSuccess: () => {
      queryClient.removeQueries();
      navigate("/login", { replace: true });
    },
  });

  return { logout, isLoading };
}
