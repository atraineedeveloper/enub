export type WorkerFormSectionId = "identity" | "contact" | "employment" | "relations";
export const WORKER_FORM_SECTIONS: { id: WorkerFormSectionId; label: string; description: string; fields: string[] }[] = [
  { id: "identity", label: "Datos personales", description: "Nombre, RFC y fotografía", fields: ["name", "RFC", "profile_picture_file"] },
  { id: "contact", label: "Contacto y domicilio", description: "Teléfono, correo y dirección", fields: ["phone", "email", "street", "neighborhood", "post_code", "city", "state"] },
  { id: "employment", label: "Información laboral", description: "Perfil y situación laboral", fields: ["specialty", "type_worker", "status", "function_performed", "observations"] },
  { id: "relations", label: "Plazas y antigüedad", description: "Claves de pago y admisión", fields: ["sustenance_plazas", "date_of_admissions"] },
];
export function firstInvalidWorkerSection(errors: Readonly<Record<string, unknown>>): WorkerFormSectionId | undefined {
  return WORKER_FORM_SECTIONS.find((section) => section.fields.some((field) => Boolean(errors[field])))?.id;
}
