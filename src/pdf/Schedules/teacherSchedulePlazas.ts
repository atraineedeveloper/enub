export interface TeacherSchedulePlaza {
  plaza: string | null;
  payment_key: string | null;
}

export function formatTeacherSchedulePlazas(plazas: readonly TeacherSchedulePlaza[]): string[] {
  if (!plazas.length) return ["PLAZA Y CLAVE DE PAGO: No registradas"];
  return plazas.map(({ plaza, payment_key }) =>
    `PLAZA: ${plaza?.trim() || "No registrada"}     CLAVE DE PAGO: ${payment_key?.trim() || "No registrada"}`
  );
}
