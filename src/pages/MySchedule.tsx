import Heading from "../ui/Heading";

// Temporarily an empty placeholder (product decision, not a defect):
// "Mi horario" stays visible in the worker nav and the /my-schedule route
// stays reachable, but this page deliberately does not render
// MyScheduleView, so none of its schedule queries (semesters,
// schedule_assignments, schedule_teachers) ever fire and no unnecessary
// data is loaded. MyScheduleView and the rest of the feature's code are
// untouched -- restoring the real page is just swapping this file's body
// back to `<MyScheduleView />`.
function MySchedule() {
  return <Heading as="h1">Mi horario</Heading>;
}

export default MySchedule;
