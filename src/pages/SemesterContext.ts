import { createContext } from "react";
import type { Worker } from "../features/workers/useWorkers";
import type { Subject } from "../features/subjects/useSubjects";
import type { Group } from "../features/groups/useGroups";

interface SemesterContextValue {
  groups: Group[];
  workers: Worker[];
  subjects: Subject[];
  scheduleAssignments: unknown[];
  semesterCode: string | null;
}

export const SemesterContext = createContext<SemesterContextValue | null>(
  null
);
