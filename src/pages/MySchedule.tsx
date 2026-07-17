import MyScheduleView from "../features/schedules/MyScheduleView";

// Gating (loading -> staff/admin redirect -> invalid-link redirect) lives
// above this page, at the route-branch level (App.tsx's WorkerRouteGate
// layout route) -- nothing worker-facing renders before that resolves.
// MyScheduleView resolves its own authUserId/workerId internally, from
// the authenticated session/profile path, never from a prop here.
function MySchedule() {
  return <MyScheduleView />;
}

export default MySchedule;
