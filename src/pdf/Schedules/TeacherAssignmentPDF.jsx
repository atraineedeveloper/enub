import jsPDF from "jspdf";
import "jspdf-autotable";
import Button from "../../ui/Button.jsx";
import Spinner from "../../ui/Spinner.jsx";
import { useRoles } from "../../features/roles/useRoles.js";
import { useStateRoles } from "../../features/stateRoles/useStateRoles.js";
import calculateSemesterGroup from "../../helpers/calculateSemesterGroup.js";
import capitalizeName from "../../helpers/capitalizeFirstLetter.js";

function TeacherAssignmentPDF({
  groupedSubjects,
  uniqueTeacherSchedule,
  currentWorker,
}) {
  const { isLoading: isLoadingRoles, roles } = useRoles();
  const { isLoading: isLoadingStateRoles, stateRoles } = useStateRoles();

  let totalHours = 2;

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

  console.log(groupedSubjects, uniqueTeacherSchedule);

  // console.log(currentWorker);

  const generatePDF = async () => {
    await import("../../styles/Montserrat-Regular-normal.js");
    await import("../../styles/Montserrat-Italic-italic.js");
    await import("../../styles/Montserrat-Bold-bold.js");
    await import("../../styles/Montserrat-BoldItalic-bolditalic.js");

    const doc = new jsPDF("p", "px", "letter");

    // Header

    const logoEnub = new Image();
    logoEnub.src = "/enub.jpg";
    doc.addImage(logoEnub, "JPG", 380, 10, 50, 50);

    const logoSetab = new Image();
    logoSetab.src = "/setab.jpeg";
    doc.addImage(logoSetab, "JPEG", 30, 5, 60, 60);

    doc.autoTable({
      willDrawPage: function (data) {
        // Header
        doc.autoTable({
          styles: {
            halign: "center",
            font: "Montserrat-BoldItalic",
            fontStyle: "bolditalic",
          },
          body: [["", "APRENDER PARA ENSEÑAR", ""]],
          theme: "plain",
        });
      },
      didDrawPage: function (data) {
        // Footer
        doc.setFontSize(8);

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

    // Get current date
    const options = { day: "numeric", month: "long", year: "numeric" };
    const today = new Date();
    const formattedDate = today.toLocaleDateString("es-ES", options);

    doc.autoTable({
      styles: {
        halign: "right",
        valign: "middle",
        font: "Montserrat-Regular",
        fontSize: 9,
      },
      body: [
        [
          {
            content: "DEPENDENCIA: ESCUELA NORMAL URBANA",
            styles: { font: "Montserrat-Bold" },
          },
        ],
      ],
      theme: "plain",
      startY: doc.lastAutoTable.finalY,
    });

    doc.autoTable({
      styles: {
        halign: "right",
        valign: "middle",
        font: "Montserrat-Regular",
        fontSize: 9,
      },
      body: [
        [
          {
            content: "SECCIÓN: ADMINISTRACIÓN",
            styles: { font: "Montserrat-Bold" },
          },
        ],
      ],
      theme: "plain",
      startY: doc.lastAutoTable.finalY - 8,
    });

    doc.autoTable({
      styles: {
        halign: "right",
        valign: "middle",
        font: "Montserrat-Regular",
        fontSize: 9,
      },
      body: [
        [
          {
            content: "MESA: SUBDIRECCIÓN ACADEMICA.",
            styles: { font: "Montserrat-Bold" },
          },
        ],
      ],
      theme: "plain",
      startY: doc.lastAutoTable.finalY - 8,
    });

    doc.autoTable({
      styles: {
        halign: "right",
        valign: "middle",
        font: "Montserrat-Regular",
        fontSize: 9,
      },
      body: [
        [
          {
            content: `OFICIO Nº: SDAC/ENU/085/${new Date().getFullYear()}`,
            styles: { font: "Montserrat-Bold" },
          },
        ],
      ],
      theme: "plain",
      startY: doc.lastAutoTable.finalY - 8,
    });

    doc.autoTable({
      styles: {
        halign: "right",
        valign: "middle",
        font: "Montserrat-Regular",
        fontSize: 9,
      },
      body: [
        [
          {
            content: "Asunto: Asignación de carga horaria",
            styles: { font: "Montserrat-Bold" },
          },
        ],
      ],
      theme: "plain",
      startY: doc.lastAutoTable.finalY - 8,
    });

    doc.autoTable({
      styles: {
        halign: "right",
        valign: "middle",
        font: "Montserrat-Regular",
        fontSize: 9,
      },
      body: [[`Balancán, Tabasco a ${formattedDate}`]],
      theme: "plain",
      startY: doc.lastAutoTable.finalY - 8,
    });

    // Info of teacher
    doc.autoTable({
      styles: {
        valign: "middle",
        font: "Montserrat-Regular",
        fontSize: 10,
      },
      body: [
        [
          {
            content: `MTRO(A). ${capitalizeName(currentWorker[0].name)}`,
            styles: { font: "Montserrat-Bold" },
          },
        ],
      ],
      theme: "plain",
      startY: doc.lastAutoTable.finalY - 4,
    });

    doc.autoTable({
      styles: {
        valign: "middle",
        font: "Montserrat-Regular",
        fontSize: 10,
      },
      body: [
        [
          {
            content: "DOCENTE DE LA ESCUELA NORMAL URBANA",
            styles: { font: "Montserrat-Bold" },
          },
        ],
      ],
      theme: "plain",
      startY: doc.lastAutoTable.finalY - 8,
    });

    doc.autoTable({
      styles: {
        valign: "middle",
        font: "Montserrat-Regular",
        fontSize: 10,
      },
      body: [
        [
          {
            content: "PRESENTE",
            styles: { font: "Montserrat-Bold" },
          },
        ],
      ],
      theme: "plain",
      startY: doc.lastAutoTable.finalY - 8,
    });

    doc.autoTable({
      styles: {
        halign: "justify",
        fontSize: 10,
      },
      body: [
        [
          "En apego de los lineamientos que establecen la regulación de las Actividades sustantivas que debe realizar todo profesor adscrito a una Institución de Educación Superior (IES), y con base a su nombramiento como profesor de la Escuela Normal Urbana, en cumplimiento a las atribuciones conferidas a esta subdirección, me permito hacer la asignación de su carga horaria para el presente semestre. Misma que deberá desempeñar con el sentido de responsabilidad y compromiso que siempre ha demostrado en cada una de las tareas que se le han encomendado.",
        ],
      ],
      theme: "plain",
      startY: doc.lastAutoTable.finalY,
    });

    // Sumar horas de asignaturas impartidas

    Object.keys(groupedSubjects).map(
      (subject) => (totalHours += groupedSubjects[subject].length * 2)
    );

    uniqueTeacherSchedule.map(
      (schedule) => (totalHours += schedule.quantity * 2)
    );

    doc.autoTable({
      styles: {
        halign: "center",
        valign: "middle",
        font: "Montserrat-Regular",
        fontSize: 7,
      },
      headStyles: {
        fillColor: [0, 0, 0],
        font: "Montserrat-Bold",
      },
      columnStyles: {
        0: { cellWidth: 66 },
        1: { cellWidth: 66 },
        2: { cellWidth: 66 },
        3: { cellWidth: 66 },
        4: { cellWidth: 66 },
        5: { cellWidth: 66 },
      },
      footStyles: {
        fillColor: [0, 0, 0],
        font: "Montserrat-Bold",
      },
      head: [
        [
          "NOMBRE DEL CURSO",
          "LICENCIATURA",
          "SEMESTRE Y GRUPO",
          "DURACIÓN EN SEMANA",
          "HORAS POR SEMESTRE",
          "HRS. SEMANALES DEDICADAS AL CURSO, ACTIVIDAD O COMISIÓN",
        ],
      ],
      body: Object.keys(groupedSubjects).map((subject) => {
        return [
          groupedSubjects[subject][0].subjects.name.toUpperCase(),
          groupedSubjects[subject][0].groups.degrees.code,
          `${Object.keys(groupData(groupedSubjects[subject], "group_id")).map(
            (group) => {
              return `   ${calculateSemesterGroup(
                groupData(groupedSubjects[subject], "group_id")[group][0].groups
                  .year_of_admission
              )}° " ${
                groupData(groupedSubjects[subject], "group_id")[group][0].groups
                  .letter
              }"`;
            }
          )}`,
          groupedSubjects[subject].length * 2,
          "",
          groupedSubjects[subject].length * 2,
        ];
      }),
      theme: "grid",
      startY: doc.lastAutoTable.finalY,
    });

    doc.autoTable({
      styles: {
        halign: "center",
        valign: "middle",
        font: "Montserrat-Regular",
        fontSize: 7,
      },
      headStyles: {
        fillColor: [0, 0, 0],
        font: "Montserrat-Bold",
      },
      columnStyles: {
        0: { cellWidth: 66 },
        1: { cellWidth: 66 },
        2: { cellWidth: 66 },
        3: { cellWidth: 66 },
        4: { cellWidth: 66 },
        5: { cellWidth: 66 },
      },
      footStyles: {
        fillColor: [0, 0, 0],
        font: "Montserrat-Bold",
      },
      body: uniqueTeacherSchedule.map(({ name, quantity }) => {
        return [name, "", "", "", "", quantity * 2];
      }),
      theme: "grid",
      startY: doc.lastAutoTable.finalY - 3,
    });
    if (totalHours == 40) {
      doc.autoTable({
        styles: {
          halign: "center",
          valign: "middle",
          font: "Montserrat-Regular",
          fontSize: 7,
        },
        headStyles: {
          fillColor: [0, 0, 0],
          font: "Montserrat-Bold",
        },
        columnStyles: {
          0: { cellWidth: 66 },
          1: { cellWidth: 264 },
          2: { cellWidth: 66 },
        },
        footStyles: {
          fillColor: [0, 0, 0],
          font: "Montserrat-Bold",
        },
        body: [
          ["TUTORÍA", "", "1"],
          ["ACTO CÍVICO", "LUNES Y FECHAS CONMEMORATIVAS", "1"],
          [
            "ACADEMIA",
            "(GENERAL, LICENCIATURA, SEMESTRE Y TRAYECTO FORMATIVO)",
            "2",
          ],
        ],
        theme: "grid",
        startY: doc.lastAutoTable.finalY,
      });
    }

    doc.autoTable({
      styles: {
        halign: "center",
        valign: "middle",
        font: "Montserrat-Bold",
        fontSize: 7,
      },
      headStyles: {
        fillColor: [0, 0, 0],
      },
      columnStyles: {
        0: { cellWidth: 66 },
        1: { cellWidth: 264 },
        2: { cellWidth: 66 },
      },
      body: [
        ["TOTAL", "", `${totalHours == 40 ? totalHours : totalHours - 2} HRS`],
      ],
      theme: "grid",
      startY: doc.lastAutoTable.finalY,
    });

    doc.autoTable({
      styles: {
        halign: "center",
        valign: "middle",
        font: "Montserrat-Regular",
        fontSize: 10,
      },
      body: [["Atentamente"]],
      theme: "plain",
      startY: doc.lastAutoTable.finalY,
    });

    doc.autoTable({
      styles: {
        halign: "center",
        valign: "middle",
        font: "Montserrat-Regular",
        fontSize: 10,
      },
      body: [[capitalizeName(roles[0].workers.name)]],
      theme: "plain",
    });

    doc.autoTable({
      styles: {
        halign: "center",
        valign: "middle",
        font: "Montserrat-Regular",
        fontSize: 10,
      },
      body: [[roles[0].role]],
      theme: "plain",
      startY: doc.lastAutoTable.finalY - 8,
    });

    doc.output("dataurlnewwindow");
  };
  return (
    <Button variation="secondary" onClick={generatePDF}>
      Generar asignación horaria del maestro
    </Button>
  );
}

export default TeacherAssignmentPDF;
