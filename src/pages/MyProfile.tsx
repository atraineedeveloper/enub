import MyProfileView from "../features/workers/MyProfileView";

// Gating (loading -> staff/admin redirect -> invalid-link redirect) lives
// above this page, at the route-branch level (App.tsx's WorkerRouteGate
// layout route) -- nothing worker-facing renders before that resolves.
// MyProfileView resolves its own authUserId/workerId internally, from the
// authenticated session/profile path, never from a prop here.
function MyProfile() {
  return <MyProfileView />;
}

export default MyProfile;
