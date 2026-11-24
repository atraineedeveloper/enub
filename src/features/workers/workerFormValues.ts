import type { Worker } from "./useWorkers";
import type { SustenancePlazaInput, DateOfAdmissionInput } from "../../types/workerMutation";

// HTML select returns a string; loaded rows use numeric status. Preserve both.
export type WorkerFormValues = Omit<Partial<Worker>, "status"> & {
  status?: number | string | null;
  sustenance_plazas?: SustenancePlazaInput[];
  date_of_admissions?: DateOfAdmissionInput[];
  profile_picture_file?: FileList | null;
  remove_profile_picture?: boolean;
  schedule_assignments?: unknown[];
  schedule_teachers?: unknown[];
};
