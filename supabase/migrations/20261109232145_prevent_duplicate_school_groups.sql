ALTER TABLE public.groups
ADD CONSTRAINT groups_admission_year_letter_degree_unique
UNIQUE (year_of_admission, letter, degree_id);
