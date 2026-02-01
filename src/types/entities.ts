export interface Degree {
  id: number;
  code: string;
  name?: string | null;
}

export interface Group {
  id: number;
  year_of_admission: number;
  letter: string;
  degrees: Degree;
}

export interface Subject {
  id: number;
  name: string;
  semester?: number | null;
  degrees?: Degree;
  study_programs?: {
    id: number;
    year?: number | null;
  };
}

export interface Worker {
  id: number;
  name: string;
  status?: number | null;
}

export interface Semester {
  id: number;
  semester?: string | number;
  school_year?: string;
}

export interface ScheduleAssignment {
  id: number;
  group_id: number;
  worker_id: number;
  subject_id: number;
  semester_id: number;
  weekday: string;
  start_time: string;
  end_time: string;
  workers?: Worker;
  subjects?: Subject;
  groups?: Group;
  semesters?: Semester;
}

export interface ScheduleTeacher {
  id: number;
  worker_id: number;
  semester_id: number;
  weekday: string;
  start_time: string;
  end_time: string;
  activity: string;
  workers?: Worker;
  semesters?: Semester;
}
