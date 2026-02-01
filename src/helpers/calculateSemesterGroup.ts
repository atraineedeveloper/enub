function calculateSemesterGroup(entryYear: number): number {
  // Semestres administrativos:
  // - Semestres PARES inician el 23 de Enero.
  // - Semestres IMPARES inician el 1 de Agosto.
  
  // Asumimos que la generación ingresó el 1 de Agosto del entryYear.
  // (Si ingresó en agosto, ese día comienza semestre 1).
  
  const now = new Date();
  // const currentYear = now.getFullYear();
  // const currentMonth = now.getMonth(); // 0 = Enero, ..., 7 = Agosto
  // const currentDay = now.getDate();

  // Fecha de referencia inicial: 1 de Agosto del año de ingreso
  const startDate = new Date(entryYear, 7, 1); // Mes 7 = Agosto, Dia 1
  
  // Calculamos diferencia en milisegundos
  const diffTime = now.getTime() - startDate.getTime();
  
  // Si la fecha actual es anterior a la fecha de ingreso, retornamos 1
  if (diffTime < 0) return 1;

  let grade = 1;
  let checkDate = new Date(entryYear, 7, 1); // Inicio Semestre 1 (1 Ago)
  
  // Mientras la fecha actual sea mayor o igual al inicio del SIGUIENTE semestre, incrementamos
  while (true) {
    // Calcular inicio del siguiente semestre
    let nextSemesterDate;
    
    if (checkDate.getMonth() === 7) { 
      // Si estamos en Agosto (Impar), el siguiente es 23 de Enero del próximo año (Par)
      nextSemesterDate = new Date(checkDate.getFullYear() + 1, 0, 23);
    } else {
      // Si estamos en Enero (Par), el siguiente es 1 de Agosto del mismo año (Impar)
      nextSemesterDate = new Date(checkDate.getFullYear(), 7, 1);
    }
    
    if (now >= nextSemesterDate) {
      grade++;
      checkDate = nextSemesterDate;
    } else {
      break;
    }
  }

  return grade;
}

export default calculateSemesterGroup;
