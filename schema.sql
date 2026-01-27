-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.date_of_admissions (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  date_of_admission date,
  type character varying,
  worker_id bigint,
  CONSTRAINT date_of_admissions_pkey PRIMARY KEY (id),
  CONSTRAINT date_of_admissions_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.workers(id)
);
CREATE TABLE public.degrees (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  code character varying,
  name character varying,
  CONSTRAINT degrees_pkey PRIMARY KEY (id)
);
CREATE TABLE public.groups (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  year_of_admission integer,
  letter character varying,
  degree_id bigint,
  CONSTRAINT groups_pkey PRIMARY KEY (id),
  CONSTRAINT groups_degree_id_fkey FOREIGN KEY (degree_id) REFERENCES public.degrees(id)
);
CREATE TABLE public.roles (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  role character varying,
  worker_id bigint,
  CONSTRAINT roles_pkey PRIMARY KEY (id),
  CONSTRAINT roles_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.workers(id)
);
CREATE TABLE public.schedule_assignments (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  weekday character varying,
  group_id bigint,
  subject_id bigint,
  start_time time without time zone,
  end_time time without time zone,
  worker_id bigint,
  semester_id bigint,
  CONSTRAINT schedule_assignments_pkey PRIMARY KEY (id),
  CONSTRAINT schedule_assignments_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id),
  CONSTRAINT schedule_assignments_semester_id_fkey FOREIGN KEY (semester_id) REFERENCES public.semesters(id),
  CONSTRAINT schedule_assignments_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id),
  CONSTRAINT schedule_assignments_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.workers(id)
);
CREATE TABLE public.schedule_teachers (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  weekday character varying,
  activity character varying,
  start_time time without time zone,
  end_time time without time zone,
  worker_id bigint,
  semester_id bigint,
  CONSTRAINT schedule_teachers_pkey PRIMARY KEY (id),
  CONSTRAINT schedule_teachers_semester_id_fkey FOREIGN KEY (semester_id) REFERENCES public.semesters(id),
  CONSTRAINT schedule_teachers_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.workers(id)
);
CREATE TABLE public.semesters (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  semester character varying,
  school_year character varying,
  CONSTRAINT semesters_pkey PRIMARY KEY (id)
);
CREATE TABLE public.state_roles (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  role character varying,
  name_worker character varying,
  CONSTRAINT state_roles_pkey PRIMARY KEY (id)
);
CREATE TABLE public.study_programs (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  year integer,
  name character varying,
  CONSTRAINT study_programs_pkey PRIMARY KEY (id)
);
CREATE TABLE public.subjects (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  semester character varying,
  name character varying,
  credits real,
  hours_per_week smallint,
  hours_per_semester smallint,
  study_program_id bigint,
  degree_id bigint,
  CONSTRAINT subjects_pkey PRIMARY KEY (id),
  CONSTRAINT subject_degree_id_fkey FOREIGN KEY (degree_id) REFERENCES public.degrees(id),
  CONSTRAINT subject_study_program_id_fkey FOREIGN KEY (study_program_id) REFERENCES public.study_programs(id)
);
CREATE TABLE public.sustenance_plazas (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  sustenance character varying,
  payment_key character varying,
  plaza character varying,
  worker_id bigint,
  CONSTRAINT sustenance_plazas_pkey PRIMARY KEY (id),
  CONSTRAINT sustenance_plazas_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.workers(id)
);
CREATE TABLE public.utilities (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  description character varying,
  value character varying,
  CONSTRAINT utilities_pkey PRIMARY KEY (id)
);
CREATE TABLE public.workers (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  name character varying,
  profile_picture character varying,
  street character varying,
  neighborhood character varying,
  post_code character varying,
  city character varying,
  state character varying,
  phone character varying,
  email character varying,
  RFC character varying,
  specialty character varying,
  type_worker character varying,
  function_performed character varying,
  observations character varying,
  status smallint,
  CONSTRAINT workers_pkey PRIMARY KEY (id)
);