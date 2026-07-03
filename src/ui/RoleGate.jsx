import { Navigate } from "react-router-dom";
import { useProfile } from "../features/authentication/useProfile";
import SpinnerFullPage from "./SpinnerFullPage";

// eslint-disable-next-line react/prop-types -- children is a plain React node, matching ProtectedRoute.jsx's untyped children prop
function RoleGate({ children }) {
  const { isLoading, isStaffOrAdmin, isWorker } = useProfile();

  // 1. While the role is resolving, show a spinner
  if (isLoading) return <SpinnerFullPage />;

  // 2. Allow-list: only staff/admin reach the staff app
  if (isStaffOrAdmin) return children;

  // 3. A worker session is redirected to its own portal
  if (isWorker) return <Navigate to="/my-documents" replace />;

  // 4. Anything else (no profiles row, unrecognized role) is never let
  // through to staff routes
  return <Navigate to="/pending-access" replace />;
}

export default RoleGate;
