import { loadMontserratFonts } from "../loadMontserratFonts";
import { groupScheduleAssignments } from "../../features/schedules/groupScheduleAssignments";
import toast from "react-hot-toast";
import { loadPdfImage } from "../loadPdfImage";
import jsPDF from "jspdf";
import { autoTable } from "../montserratAutoTable";
import { useContext } from "react";
import Button from "../../ui/Button";
import { useRoles } from "../../features/roles/useRoles";
import { useStateRoles } from "../../features/stateRoles/useStateRoles";
import { calculateSemesterGroupForSemester } from "../../helpers/calculateSemesterGroup";
import capitalizeName from "../../helpers/capitalizeFirstLetter";
import { SemesterContext } from "../../pages/SemesterContext";
import type { ScheduleAssignment } from "../../features/schedules/useScheduleAssignments";
import type { Worker } from "../../features/workers/useWorkers";

type JsPdfWithAutoTable = jsPDF & { lastAutoTable: { finalY: number } };

interface TeacherAssignmentPDFProps {
  // Matches TeacherAssignment.tsx's groupScheduleAssignments() return shape (keyed by
  // subject_id, one entry per matching ScheduleAssignment).
  groupedSubjects: Record<string, ScheduleAssignment[]>;
  uniqueTeacherSchedule: { name: string; quantity: number }[];
  // TeacherAssignment.tsx passes `workers.filter(...)`, an array (0 or 1
  // entries), not a single Worker -- matches this file's `currentWorker[0]`
  // access below.
  currentWorker: Worker[];
}

function TeacherAssignmentPDF({
  groupedSubjects,
  uniqueTeacherSchedule,
  currentWorker,
}: TeacherAssignmentPDFProps) {
  const { roles } = useRoles();
  // Neither returned value is read anywhere in this file, but the call
  // itself is kept (not removed) so the query it fires still runs --
  // matching this file's siblings' behavior, which do use their own
  // useStateRoles() return values (design.md's explicit reasoning).
  useStateRoles();
  const semesterData = useContext(SemesterContext);
  const semesterCode = semesterData?.semesterCode ?? null;

  let totalHours = 2;

  

  const generatePDF = async () => {
    try {
    await loadMontserratFonts();

    const doc = new jsPDF("p", "px", "letter") as JsPdfWithAutoTable;

    // Header

    const logoEnub = await loadPdfImage("/enub.jpg");
    doc.addImage(logoEnub, "JPG", 380, 10, 50, 50);

    const logoSetab = await loadPdfImage("/setab.jpeg");
    doc.addImage(logoSetab, "JPEG", 15, 17, 130, 36);

    autoTable(doc, {
      willDrawPage: function () {
        // Header
        autoTable(doc, {
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
    const options = {
      day: "numeric",
      month: "long",
      year: "numeric",
    } as const;
    const today = new Date();
    const formattedDate = today.toLocaleDateString("es-ES", options);

    autoTable(doc, {
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

    autoTable(doc, {
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

    autoTable(doc, {
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

    autoTable(doc, {
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

    autoTable(doc, {
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

    autoTable(doc, {
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
    autoTable(doc, {
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

    autoTable(doc, {
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

    autoTable(doc, {
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

    // Native text: measure and draw using the same registered font.
    const intro = "En apego de los lineamientos que establecen la regulación de las Actividades sustantivas que debe realizar todo profesor adscrito a una Institución de Educación Superior (IES), y con base a su nombramiento como profesor de la Escuela Normal Urbana, en cumplimiento a las atribuciones conferidas a esta subdirección, me permito hacer la asignación de su carga horaria para el presente semestre. Misma que deberá desempeñar con el sentido de responsabilidad y compromiso que siempre ha demostrado en cada una de las tareas que se le han encomendado.";
    doc.setFont("Montserrat-Regular", "normal");
    doc.setFontSize(10);
    doc.setTextColor(0);
    const scale = doc.internal.scaleFactor;
    // Match AutoTable's default 40pt margin and 5pt cell padding.
    const introX = 45 / scale;
    const introWidth = doc.internal.pageSize.getWidth() - 2 * introX;
    const lineHeight = (10 / scale) * 1.2;
    const lines: string[] = doc.splitTextToSize(intro, introWidth);
    const introTop = doc.lastAutoTable.finalY + 5 / scale;
    lines.forEach((line, index) => {
      const y = introTop + index * lineHeight;
      const words = line.trim().split(/\s+/);
      // Justify explicitly to avoid a second wrapping pass inside doc.text.
      if (index === lines.length - 1 || words.length < 2) {
        doc.text(line, introX, y, { baseline: "top" });
        return;
      }
      const wordWidth = words.reduce((sum, word) => sum + doc.getTextWidth(word), 0);
      const gap = (introWidth - wordWidth) / (words.length - 1);
      let x = introX;
      for (const word of words) {
        doc.text(word, x, y, { baseline: "top" });
        x += doc.getTextWidth(word) + gap;
      }
    });
    const afterIntroY = introTop + lines.length * lineHeight + 8;

    // Sumar horas de asignaturas impartidas

    Object.keys(groupedSubjects).map(
      (subject) => (totalHours += groupedSubjects[subject].length * 2)
    );

    uniqueTeacherSchedule.map(
      (schedule) => (totalHours += schedule.quantity * 2)
    );

    autoTable(doc, {
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
          groupedSubjects[subject][0].subjects!.name!.toUpperCase(),
          groupedSubjects[subject][0].groups!.degrees!.code,
          `${Object.keys(groupScheduleAssignments(groupedSubjects[subject], "group_id")).map(
            (group) => {
              return `   ${calculateSemesterGroupForSemester(
                groupScheduleAssignments(groupedSubjects[subject], "group_id")[group][0]
                  .groups!.year_of_admission,
                semesterCode
              )}° " ${
                groupScheduleAssignments(groupedSubjects[subject], "group_id")[group][0]
                  .groups!.letter
              }"`;
            }
          )}`,
          groupedSubjects[subject].length * 2,
          "",
          groupedSubjects[subject].length * 2,
        ];
      }),
      theme: "grid",
      startY: afterIntroY,
    });

    autoTable(doc, {
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
      autoTable(doc, {
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

    autoTable(doc, {
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

    autoTable(doc, {
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

    autoTable(doc, {
      styles: {
        halign: "center",
        valign: "middle",
        font: "Montserrat-Regular",
        fontSize: 10,
      },
      body: [[capitalizeName(roles?.[0]?.workers?.name ?? "")]],
      theme: "plain",
    });

    autoTable(doc, {
      styles: {
        halign: "center",
        valign: "middle",
        font: "Montserrat-Regular",
        fontSize: 10,
      },
      body: [[roles?.[0]?.role ?? ""]],
      theme: "plain",
      startY: doc.lastAutoTable.finalY - 8,
    });

    const blobUrl = doc.output("bloburl");
    const previewWindow = window.open(blobUrl, "_blank");
    if (!previewWindow) doc.save("AsignacionHoraria.pdf");
    } catch (error) {
      console.error("PDF export failed", error);
      toast.error("No se pudo generar el PDF. Revisa los datos e inténtalo nuevamente.");
    }
  };
  return (
    <Button variation="secondary" onClick={generatePDF}>
      Generar asignación horaria del maestro
    </Button>
  );
}

export default TeacherAssignmentPDF;
