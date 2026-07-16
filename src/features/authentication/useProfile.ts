import { useQuery } from "@tanstack/react-query";
import { useUser } from "./useUser";
import { getCurrentProfile } from "../../services/apiProfiles";

export function useProfile() {
  const { user, isAuthenticated, isLoading: isLoadingUser } = useUser();

  const {
    data: profile,
    isLoading: isLoadingProfile,
    isError: isProfileError,
  } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: getCurrentProfile,
    enabled: isAuthenticated,
  });

  const role = profile?.role ?? null;
  const isLoadingResolvedProfile = isAuthenticated && isLoadingProfile;

  return {
    isLoading: isLoadingUser || isLoadingResolvedProfile,
    // Distinguishes a genuine profiles-query failure (network/RLS/db) from
    // "authenticated but no profiles row" -- both previously collapsed to
    // role: null with no way to tell them apart. Needed by
    // useCurrentIdentity's profile-error state (see design.md).
    isError: isAuthenticated && isProfileError,
    role,
    workerId: profile?.workerId ?? null,
    isWorker: role === "worker",
    isStaffOrAdmin: role === "staff" || role === "admin",
    isAdmin: role === "admin",
    hasNoAccess: isAuthenticated && !isLoadingResolvedProfile && role === null,
  };
}
