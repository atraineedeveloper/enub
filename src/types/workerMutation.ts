export interface SustenancePlazaInput {
  sustenance?: string | null;
  payment_key?: string | null;
  plaza?: string | null;
}

export interface DateOfAdmissionInput {
  type?: string | null;
  date_of_admission?: string | null;
}

export interface CreateEditWorkerOptions {
  profilePictureFile?: File | null;
  removeCurrentProfilePicture?: boolean;
  currentProfilePicture?: string | null;
  sustenancePlazas?: SustenancePlazaInput[];
  dateOfAdmissions?: DateOfAdmissionInput[];
}

