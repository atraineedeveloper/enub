import jsPDF from "jspdf";
import "jspdf-autotable";
import Button from "../ui/Button";
import { useRoles } from "../features/roles/useRoles.js";
import calculateSemesterGroup from "../helpers/calculateSemesterGroup.js";

function transformDate(dateString) {
  const [year, month, day] = dateString.split("-");
  const shortYear = year.slice(-2);

  return `${day}-${month}-${shortYear}`;
}

function getFileExtension(fileName) {
  return fileName?.split(".").pop();
}

const groupData = (array, key) => {
  return array.reduce((result, currentValue) => {
    // Obtén el valor de la propiedad por la que vamos a agrupar
    const groupKey = currentValue[key];

    // Si el grupo aún no existe, créalo
    if (!result[groupKey]) {
      result[groupKey] = [];
    }

    // Agrega el elemento actual al grupo correspondiente
    result[groupKey].push(currentValue);

    return result;
  }, {});
};

function WorkerSheetSemester({
  workers,
  semester,
  scheduleAssignments = [],
  scheduleTeachers = [],
}) {
  const activeWorkers = workers.filter((worker) => {
    return worker.status === 1;
  });

  const teacherWorkers = activeWorkers.filter((worker) => {
    return worker.type_worker === "Maestro";
  });

  const administrativeWorkers = activeWorkers.filter((worker) => {
    return worker.type_worker === "Administrativo";
  });

  const hiringWorkers = activeWorkers.filter((worker) => {
    return worker.type_worker === "Contratacion";
  });

  const { isLoading: isLoadingRoles, roles } = useRoles();

  const generatePDF = async () => {
    await import("../styles/Montserrat-Regular-normal.js");
    await import("../styles/Montserrat-Italic-italic.js");
    await import("../styles/Montserrat-Bold-bold.js");
    await import("../styles/Montserrat-BoldItalic-bolditalic.js");

    const doc = new jsPDF("landscape", "px", "letter");

    // Header

    const logoEnub = new Image();
    logoEnub.src = "/enub.jpg";
    doc.addImage(logoEnub, "JPG", 510, 10, 50, 50);

    const logoSetab = new Image();
    logoSetab.src = "/setab.jpeg";
    doc.addImage(logoSetab, "JPEG", 30, 5, 60, 60);

    doc.autoTable({
      willDrawPage: function (data) {
        // Header
        doc.autoTable({
          styles: {
            halign: "center",
            font: "Montserrat-Italic",
            fontStyle: "italic",
            fontSize: 7,
          },
          body: [["SECRETARÍA DE EDUCACIÓN"]],
          theme: "plain",
          startY: 5,
        });

        doc.autoTable({
          styles: {
            halign: "center",
            font: "Montserrat-Italic",
            fontStyle: "italic",
            fontSize: 7,
          },
          body: [["SUBSECRETARÍA DE EDUCACIÓN MEDIA Y SUPERIOR"]],
          theme: "plain",
          startY: doc.lastAutoTable.finalY - 5,
        });

        doc.autoTable({
          styles: {
            halign: "center",
            font: "Montserrat-Italic",
            fontStyle: "italic",
            fontSize: 7,
          },
          body: [["DIRECCIÓN DE EDUCACIÓN SUPERIOR"]],
          theme: "plain",
          startY: doc.lastAutoTable.finalY - 5,
        });

        doc.autoTable({
          styles: {
            halign: "center",
            font: "Montserrat-Italic",
            fontStyle: "italic",
            fontSize: 7,
          },
          body: [["COORDINACIÓN DE ESCUELAS NORMALES, IESMA Y UPN"]],
          theme: "plain",
          startY: doc.lastAutoTable.finalY - 5,
        });

        let wantedTableWidth = 360;
        let pageWidth = doc.internal.pageSize.width;
        let margin1 = (pageWidth - wantedTableWidth) / 2;

        doc.autoTable({
          styles: {
            halign: "center",
            font: "Montserrat-BoldItalic",
            fontStyle: "bolditalic",
            fontSize: 7,
          },
          columnStyles: {
            0: { cellWidth: 90 },
            1: { cellWidth: 90 },
            2: { cellWidth: 90 },
            3: { cellWidth: 90 },
          },
          body: [
            [
              "ESCUELA: NORMAL URBANA",
              "PLAN DE ESTUDIOS: 2022",
              "C.C.T.27DNL0001K",
              "MODALIDAD: ESCOLARIZADA",
            ],
            [
              {
                content: "LICENCIATURA: EN EDUCACIÓN PRIMARIA Y PREESCOLAR",
                colSpan: 2,
              },
              "TURNO:MATUTINO",
              `CICLO ESCOLAR: ${semester[0].school_year}`,
            ],
            [
              {
                content: "DIRECCIÓN: PERIFÉRICO S/N.  COL. LAS FLORES",
                colSpan: 2,
              },
              {
                content: "MUNICIPIO: BALANCÁN, TABASCO.",
                colSpan: 2,
              },
            ],
          ],
          theme: "plain",
          margin: { left: margin1, right: margin1 },
          startY: doc.lastAutoTable.finalY,
        });
      },
      didDrawPage: function (data) {
        // Footer
        doc.setFontSize(10);

        // jsPDF 1.4+ uses getHeight, <1.4 uses .height
        var pageSize = doc.internal.pageSize;
        var pageHeight = pageSize.height
          ? pageSize.height
          : pageSize.getHeight();

        doc.setFont("Montserrat-Regular");
        doc.text("Periférico S/N", data.settings.margin.left, pageHeight - 60);
        doc.text(
          "Col. Las Flores. CP. 86930",
          data.settings.margin.left,
          pageHeight - 50
        );
        doc.text(
          "Teléfono (934) 344 04 77, 344 04 88",
          data.settings.margin.left,
          pageHeight - 40
        );
        doc.text(
          "Balancán, Tabasco",
          data.settings.margin.left,
          pageHeight - 30
        );
        doc.text(
          "escuela.normalurbana@correo.setab.gob.mx",
          data.settings.margin.left,
          pageHeight - 20
        );
      },
      margin: { top: 70 },
    });

    const columns = [
      "PROG",
      "NOMBRE, DOMICILIO, FECHA DE INGRESO, CORREO ELÉCTRONICO, TELÉFONO",
      "RFC",
      "SOST",
      "PLAZA Y CLAVE DE PAGO",
      "PREPARACIÓN PROFESIONAL (ESPECIALIDAD)",
      "ASIGNATURA QUE IMPARTE (GRADO Y GRUPO)",
      "HRS. FRENTE A GRUPO",
      "DESCARGA ACADÉMICA",
      "FOTOS",
      "FIRMA",
      "OBSERVACIONES",
    ];

    doc.autoTable({
      styles: {
        halign: "left",
        valign: "middle",
        font: "Montserrat-Regular",
        fontSize: 7,
      },
      headStyles: {
        fillColor: [0, 0, 0],
        font: "Montserrat-Bold",
      },
      /* columnStyles: {
        0: { cellWidth: 50 },
      }, */
      head: [columns],
      body: teacherWorkers.map((worker) => {
        // Extract the subjects from current semester
        const currentSemesterSchedules = scheduleAssignments.filter(
          (schedule) => schedule.worker_id === worker.id
        );

        // console.log(currentSemesterSchedules);

        const groupedSubjects = groupData(
          currentSemesterSchedules,
          "subject_id"
        );

        let numHours = 0;
        let totalHours = 2;

        const currentSemesterTeacherSchedules = scheduleTeachers.filter(
          (schedule) => schedule.worker_id === worker.id
        );

        const countTeacherSchedules = currentSemesterTeacherSchedules.reduce(
          (acc, item) => {
            const trimmedAcitivity = item.activity.trim();

            if (acc[trimmedAcitivity]) {
              acc[trimmedAcitivity]++;
            } else {
              acc[trimmedAcitivity] = 1;
            }
            return acc;
          },
          {}
        );

        const uniqueTeacherSchedule = Object.keys(countTeacherSchedules).map(
          (schedule) => {
            return {
              name: schedule,
              quantity: countTeacherSchedules[schedule],
            };
          }
        );

        // Count num hours

        Object.keys(groupedSubjects).map(
          (subject) => (numHours += groupedSubjects[subject].length * 2)
        );

        // Count total hours

        Object.keys(groupedSubjects).map(
          (subject) => (totalHours += groupedSubjects[subject].length * 2)
        );

        uniqueTeacherSchedule.map(
          (schedule) => (totalHours += schedule.quantity * 2)
        );

        // console.log(profilePicture.src);

        return [
          worker.id,
          `${worker.name}
  CALLE: ${worker.street}
  ${worker.neighborhood}
  TEL: ${worker.phone}
  C.P: ${worker.post_code}
  ${worker.city}, ${worker.state}
  ${worker.email === null ? "" : worker.email}
  ${worker.date_of_admissions.map(
    (date) => ` ${date.type}: ${transformDate(date.date_of_admission)}`
  )}`,
          worker.RFC,
          `${worker.sustenance_plazas.map(
            ({ sustenance }) => `
  ${sustenance}`
          )}`,
          `${worker.sustenance_plazas.map(
            ({ payment_key, plaza }) => `
  ${payment_key}
  ${plaza}`
          )}`,
          worker.specialty,
          Object.keys(groupedSubjects).map(
            (subject) => `
  ${groupedSubjects[subject][0].subjects.name} 
  
  ${Object.keys(groupData(groupedSubjects[subject], "group_id")).map(
    (group) =>
      ` (${calculateSemesterGroup(
        groupData(groupedSubjects[subject], "group_id")[group][0].groups
          .year_of_admission
      )} ° "${
        groupData(groupedSubjects[subject], "group_id")[group][0].groups.letter
      }")`
  )} - ${groupedSubjects[subject][0].groups.degrees.code}
  `
          ),
          "",
          `${numHours > 0 ? `NO. DE HORAS: ${numHours}` : ""}
  
  ${totalHours > 2 ? `TOTAL DE HORAS: ${totalHours}` : ""}`,
          "",
          "",
          worker.observations,
        ];
      }),
      theme: "grid",
      didDrawCell: function (data) {
        if (data.column.index === 9 && data.cell.section === "body") {
          if (data.row.index !== -1) {
            const profilePicture = new Image();
            let isThereAnImage = false;
            if (teacherWorkers[data.row.index].profile_picture) {
              profilePicture.src = `https://xqaarjwmyclltbkaedvo.supabase.co/storage/v1/object/public/profile_pictures/${
                teacherWorkers[data.row.index].profile_picture
              }`;
              isThereAnImage = true;

              var dim = data.cell.height - data.cell.padding("vertical");
              const fileExtension = getFileExtension(
                teacherWorkers[data.row.index].profile_picture
              );

              doc.addImage(
                profilePicture.src,
                fileExtension.toUpperCase(),
                data.cell.x + 2,
                data.cell.y + 2,
                20,
                30
              );
              // console.log(profilePicture.src);
            }
          }
        }
      },
    });

    doc.autoTable({
      styles: {
        halign: "center",
        font: "Montserrat-Italic",
        fontStyle: "italic",
        fontSize: 7,
      },
      headStyles: {
        fillColor: [0, 0, 0],
        font: "Montserrat-Bold",
      },
      head: [["PERSONAL ADMINISTRATIVO Y DE APOYO A LA EDUCACION"]],
      theme: "grid",
    });

    doc.autoTable({
      styles: {
        halign: "left",
        valign: "middle",
        font: "Montserrat-Regular",
        fontSize: 7,
      },
      headStyles: {
        fillColor: [0, 0, 0],
        font: "Montserrat-Bold",
      },
      /* columnStyles: {
        0: { cellWidth: 50 },
      }, */
      head: [columns],
      body: administrativeWorkers.map((worker) => {
        const currentSemesterSchedules = scheduleAssignments.filter(
          (schedule) => schedule.worker_id === worker.id
        );

        const groupedSubjects = groupData(
          currentSemesterSchedules,
          "subject_id"
        );

        let numHours = 0;
        let totalHours = 2;

        const currentSemesterTeacherSchedules = scheduleTeachers.filter(
          (schedule) => schedule.worker_id === worker.id
        );

        const countTeacherSchedules = currentSemesterTeacherSchedules.reduce(
          (acc, item) => {
            const trimmedAcitivity = item.activity.trim();

            if (acc[trimmedAcitivity]) {
              acc[trimmedAcitivity]++;
            } else {
              acc[trimmedAcitivity] = 1;
            }
            return acc;
          },
          {}
        );

        const uniqueTeacherSchedule = Object.keys(countTeacherSchedules).map(
          (schedule) => {
            return {
              name: schedule,
              quantity: countTeacherSchedules[schedule],
            };
          }
        );

        // Count num hours

        Object.keys(groupedSubjects).map(
          (subject) => (numHours += groupedSubjects[subject].length * 2)
        );

        // Count total hours

        Object.keys(groupedSubjects).map(
          (subject) => (totalHours += groupedSubjects[subject].length * 2)
        );

        uniqueTeacherSchedule.map(
          (schedule) => (totalHours += schedule.quantity * 2)
        );

        // console.log(profilePicture.src);

        return [
          worker.id,
          `${worker.name}
  CALLE: ${worker.street}
  ${worker.neighborhood}
  TEL: ${worker.phone}
  C.P: ${worker.post_code}
  ${worker.city}, ${worker.state}
  ${worker.email === null ? "" : worker.email}
  ${worker.date_of_admissions.map(
    (date) => ` ${date.type}: ${transformDate(date.date_of_admission)}`
  )}`,
          worker.RFC,
          `${worker.sustenance_plazas.map(
            ({ sustenance }) => `
  ${sustenance}`
          )}`,
          `${worker.sustenance_plazas.map(
            ({ payment_key, plaza }) => `
  ${payment_key}
  ${plaza}`
          )}`,
          worker.specialty,
          Object.keys(groupedSubjects).map(
            (subject) => `
  ${groupedSubjects[subject][0].subjects.name} 
  
  ${Object.keys(groupData(groupedSubjects[subject], "group_id")).map(
    (group) =>
      ` (${calculateSemesterGroup(
        groupData(groupedSubjects[subject], "group_id")[group][0].groups
          .year_of_admission
      )} ° "${
        groupData(groupedSubjects[subject], "group_id")[group][0].groups.letter
      }")`
  )} - ${groupedSubjects[subject][0].groups.degrees.code}
  `
          ),
          "",
          `${numHours > 0 ? `NO. DE HORAS: ${numHours}` : ""}
  
  ${totalHours > 2 ? `TOTAL DE HORAS: ${totalHours}` : ""}`,
          "",
          "",
          worker.observations,
        ];
      }),
      theme: "grid",
      didDrawCell: function (data) {
        if (data.column.index === 9 && data.cell.section === "body") {
          if (data.row.index !== -1) {
            const profilePicture = new Image();
            let isThereAnImage = false;
            if (administrativeWorkers[data.row.index].profile_picture) {
              profilePicture.src = `https://xqaarjwmyclltbkaedvo.supabase.co/storage/v1/object/public/profile_pictures/${
                administrativeWorkers[data.row.index].profile_picture
              }`;
              isThereAnImage = true;

              var dim = data.cell.height - data.cell.padding("vertical");
              const fileExtension = getFileExtension(
                administrativeWorkers[data.row.index].profile_picture
              );

              doc.addImage(
                profilePicture.src,
                fileExtension.toUpperCase(),
                data.cell.x + 2,
                data.cell.y + 2,
                20,
                30
              );
              // console.log(profilePicture.src);
            }
          }
        }
      },
    });

    doc.autoTable({
      styles: {
        halign: "center",
        font: "Montserrat-Italic",
        fontStyle: "italic",
        fontSize: 7,
      },
      headStyles: {
        fillColor: [0, 0, 0],
        font: "Montserrat-Bold",
      },
      head: [["CONTRATACIÓN"]],
      theme: "grid",
    });

    doc.autoTable({
      styles: {
        halign: "left",
        valign: "middle",
        font: "Montserrat-Regular",
        fontSize: 7,
      },
      headStyles: {
        fillColor: [0, 0, 0],
        font: "Montserrat-Bold",
      },
      /* columnStyles: {
        0: { cellWidth: 50 },
      }, */
      head: [columns],
      body: hiringWorkers.map((worker) => {
        const currentSemesterSchedules = scheduleAssignments.filter(
          (schedule) => schedule.worker_id === worker.id
        );

        const groupedSubjects = groupData(
          currentSemesterSchedules,
          "subject_id"
        );

        let numHours = 0;
        let totalHours = 2;

        const currentSemesterTeacherSchedules = scheduleTeachers.filter(
          (schedule) => schedule.worker_id === worker.id
        );

        const countTeacherSchedules = currentSemesterTeacherSchedules.reduce(
          (acc, item) => {
            const trimmedAcitivity = item.activity.trim();

            if (acc[trimmedAcitivity]) {
              acc[trimmedAcitivity]++;
            } else {
              acc[trimmedAcitivity] = 1;
            }
            return acc;
          },
          {}
        );

        const uniqueTeacherSchedule = Object.keys(countTeacherSchedules).map(
          (schedule) => {
            return {
              name: schedule,
              quantity: countTeacherSchedules[schedule],
            };
          }
        );

        // Count num hours

        Object.keys(groupedSubjects).map(
          (subject) => (numHours += groupedSubjects[subject].length * 2)
        );

        // Count total hours

        Object.keys(groupedSubjects).map(
          (subject) => (totalHours += groupedSubjects[subject].length * 2)
        );

        uniqueTeacherSchedule.map(
          (schedule) => (totalHours += schedule.quantity * 2)
        );

        // console.log(profilePicture.src);

        return [
          worker.id,
          `${worker.name}
  CALLE: ${worker.street}
  ${worker.neighborhood}
  TEL: ${worker.phone}
  C.P: ${worker.post_code}
  ${worker.city}, ${worker.state}
  ${worker.email === null ? "" : worker.email}
  ${worker.date_of_admissions.map(
    (date) => ` ${date.type}: ${transformDate(date.date_of_admission)}`
  )}`,
          worker.RFC,
          `${worker.sustenance_plazas.map(
            ({ sustenance }) => `
  ${sustenance}`
          )}`,
          `${worker.sustenance_plazas.map(
            ({ payment_key, plaza }) => `
  ${payment_key}
  ${plaza}`
          )}`,
          worker.specialty,
          Object.keys(groupedSubjects).map(
            (subject) => `
  ${groupedSubjects[subject][0].subjects.name} 
  
  ${Object.keys(groupData(groupedSubjects[subject], "group_id")).map(
    (group) =>
      ` (${calculateSemesterGroup(
        groupData(groupedSubjects[subject], "group_id")[group][0].groups
          .year_of_admission
      )} ° "${
        groupData(groupedSubjects[subject], "group_id")[group][0].groups.letter
      }")`
  )} - ${groupedSubjects[subject][0].groups.degrees.code}
  `
          ),
          "",
          `${numHours > 0 ? `NO. DE HORAS: ${numHours}` : ""}
  
  ${totalHours > 2 ? `TOTAL DE HORAS: ${totalHours}` : ""}`,
          "",
          "",
          worker.observations,
        ];
      }),
      theme: "grid",
      didDrawCell: function (data) {
        if (data.column.index === 9 && data.cell.section === "body") {
          if (data.row.index !== -1) {
            const profilePicture = new Image();
            let isThereAnImage = false;
            if (hiringWorkers[data.row.index].profile_picture) {
              profilePicture.src = `https://xqaarjwmyclltbkaedvo.supabase.co/storage/v1/object/public/profile_pictures/${
                hiringWorkers[data.row.index].profile_picture
              }`;
              isThereAnImage = true;

              var dim = data.cell.height - data.cell.padding("vertical");
              const fileExtension = getFileExtension(
                hiringWorkers[data.row.index].profile_picture
              );

              doc.addImage(
                profilePicture.src,
                fileExtension.toUpperCase(),
                data.cell.x + 2,
                data.cell.y + 2,
                20,
                30
              );
              // console.log(profilePicture.src);
            }
          }
        }
      },
    });

    doc.save("Plantilla");
  };

  return <Button onClick={generatePDF}>Imprimir plantilla horaria</Button>;
}

export default WorkerSheetSemester;
