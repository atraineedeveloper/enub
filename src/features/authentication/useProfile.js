import { useQuery } from "@tanstack/react-query";
import { useUser } from "./useUser";
import { getCurrentProfile } from "../../services/apiProfiles";

export function useProfile() {
  const { user, isAuthenticated, isLoading: isLoadingUser } = useUser();

  const { data: profile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: getCurrentProfile,
    enabled: isAuthenticated,
  });

  const role = profile?.role ?? null;
  const isLoadingResolvedProfile = isAuthenticated && isLoadingProfile;

  return {
    isLoading: isLoadingUser || isLoadingResolvedProfile,
    role,
    workerId: profile?.workerId ?? null,
    isWorker: role === "worker",
    isStaffOrAdmin: role === "staff" || role === "admin",
    isAdmin: role === "admin",
    hasNoAccess: isAuthenticated && !isLoadingResolvedProfile && role === null,
  };
}
