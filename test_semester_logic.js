
function calculateSemesterGroup(entryYear, mockDate) {
  const now = mockDate;
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

// Simulamos ingreso en 2024
const entryYear = 2024;

console.log("Ingreso 2024:");
console.log("Julio 2024 (Mes 6):", calculateSemesterGroup(entryYear, new Date(2024, 6, 15))); // Debería ser 1 (aunque técnicamente antes de agosto) o 0 si la lógica fuera estricta, pero el max(0) lo hace 1.
console.log("Agosto 2024 (Mes 7):", calculateSemesterGroup(entryYear, new Date(2024, 7, 15)));
console.log("Enero 2025 (Mes 0):", calculateSemesterGroup(entryYear, new Date(2025, 0, 15)));
console.log("Febrero 2025 (Mes 1):", calculateSemesterGroup(entryYear, new Date(2025, 1, 15)));
console.log("Julio 2025 (Mes 6):", calculateSemesterGroup(entryYear, new Date(2025, 6, 15)));
console.log("Agosto 2025 (Mes 7):", calculateSemesterGroup(entryYear, new Date(2025, 7, 15)));
