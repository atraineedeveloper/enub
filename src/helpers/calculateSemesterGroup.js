function calculateSemesterGroup(entryYear) {
  // Semestres administrativos comienzan en agosto y febrero.
  // Suponemos ingreso en agosto del año dado; cada semestre dura 6 meses.
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0 = enero

  // Meses transcurridos desde agosto del año de ingreso.
  const monthsElapsed = Math.max(
    0,
    (currentYear - entryYear) * 12 + (currentMonth - 7)
  );

  // Cada bloque de 6 meses avanza un semestre (grado); arrancamos en 1.
  const grade = 1 + Math.floor(monthsElapsed / 6);

  return grade;
}

export default calculateSemesterGroup;
