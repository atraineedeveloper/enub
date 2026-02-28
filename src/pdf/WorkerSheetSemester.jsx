import jsPDF from "jspdf";
import "jspdf-autotable";
import Button from "../ui/Button";
import { useRoles } from "../features/roles/useRoles.js";
import calculateSemesterGroup from "../helpers/calculateSemesterGroup.js";
import capitalizeName from "../helpers/capitalizeFirstLetter.js";
import Spinner from "../ui/Spinner.jsx";

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

const normalizeMultilineText = (value) =>
  String(value ?? "")
    .replace(/\n[ \t]+/g, "\n")
    .trim();

const buildFunctionPerformedText = (
  workerFunctionPerformed,
  uniqueTeacherSchedule
) => {
  const manualFunction = String(workerFunctionPerformed ?? "").trim();
  const activities = (uniqueTeacherSchedule ?? [])
    .filter((item) => item?.name?.trim())
    .map((item) => item.name.trim());

  const merged = [manualFunction, ...activities].filter(Boolean);
  const seen = new Set();
  const deduped = merged.filter((item) => {
    const key = item.toUpperCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return deduped.join("\n\n");
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
  const availableRoles = roles ?? [];

  const findRoleByKeywords = (keywords = []) =>
    availableRoles.find((role) =>
      keywords.some((keyword) =>
        role?.role?.toLowerCase().includes(keyword.toLowerCase())
      )
    );

  const leftFooterRole =
    findRoleByKeywords(["subdirector"]) ??
    availableRoles[1] ??
    availableRoles[0] ??
    null;
  const rightFooterRole =
    findRoleByKeywords(["encargado", "director"]) ??
    availableRoles.find((role) => role?.id !== leftFooterRole?.id) ??
    availableRoles[0] ??
    null;

  const toUpperEs = (value = "") => value.trim().toLocaleUpperCase("es-MX");

  const leftFooterName = leftFooterRole?.workers?.name
    ? toUpperEs(capitalizeName(leftFooterRole.workers.name))
    : "—";
  const leftFooterTitle = leftFooterRole?.role
    ? toUpperEs(leftFooterRole.role)
    : "SUBDIRECTOR ACADÉMICO";
  const rightFooterName = rightFooterRole?.workers?.name
    ? toUpperEs(capitalizeName(rightFooterRole.workers.name))
    : "—";
  const rightFooterTitle = rightFooterRole?.role
    ? toUpperEs(rightFooterRole.role)
    : "ENCARGADO DEL DESPACHO DE LA DIRECCIÓN DE LA ESCUELA";

  const generatePDF = async () => {
    await import("../styles/Montserrat-Regular-normal.js");
    await import("../styles/Montserrat-Italic-italic.js");
    await import("../styles/Montserrat-Bold-bold.js");
    await import("../styles/Montserrat-BoldItalic-bolditalic.js");

    const doc = new jsPDF("landscape", "px", "letter");
    const logoEnub = new Image();
    logoEnub.src = "/enub.jpg";

    const logoSetab = new Image();
    logoSetab.src = "/setab.jpeg";
    const drawnPages = new Set();
    const tableMargins = { top: 96, right: 18, bottom: 112, left: 18 };
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    function drawWorkerPhotoInCell(data, profilePictureName) {
      if (!profilePictureName) return;

      const fileExtension = getFileExtension(profilePictureName);
      if (!fileExtension) return;

      const photoUrl = `https://xqaarjwmyclltbkaedvo.supabase.co/storage/v1/object/public/profile_pictures/${profilePictureName}`;
      const innerWidth = data.cell.width - data.cell.padding("horizontal");
      const innerHeight = data.cell.height - data.cell.padding("vertical");

      if (innerWidth <= 0 || innerHeight <= 0) return;

      // Keep portrait ratio near 2:3 and fit inside the current cell.
      const maxPhotoWidth = Math.min(20, innerWidth - 0.6);
      const maxPhotoHeight = Math.min(30, innerHeight - 0.6);
      if (maxPhotoWidth <= 0 || maxPhotoHeight <= 0) return;

      let drawWidth = maxPhotoWidth;
      let drawHeight = drawWidth * 1.5;

      if (drawHeight > maxPhotoHeight) {
        drawHeight = maxPhotoHeight;
        drawWidth = drawHeight / 1.5;
      }

      const drawX = data.cell.x + (data.cell.width - drawWidth) / 2;
      const drawY = data.cell.y + (data.cell.height - drawHeight) / 2;

      doc.addImage(
        photoUrl,
        fileExtension.toUpperCase(),
        drawX,
        drawY,
        drawWidth,
        drawHeight
      );
    }

    function drawPageHeaderFooter(data) {
      const currentPageNumber = doc.internal.getCurrentPageInfo().pageNumber;
      if (drawnPages.has(currentPageNumber)) return;
      drawnPages.add(currentPageNumber);

      const left = data?.settings?.margin?.left ?? tableMargins.left;
      const right = data?.settings?.margin?.right ?? tableMargins.right;
      const centerX = pageWidth / 2;

      doc.addImage(logoSetab, "JPEG", left + 6, 8, 46, 46);
      doc.addImage(logoEnub, "JPG", pageWidth - right - 52, 10, 46, 46);

      doc.setFont("Montserrat-Italic", "italic");
      doc.setFontSize(7);
      doc.text("SECRETARÍA DE EDUCACIÓN", centerX, 14, { align: "center" });
      doc.text(
        "SUBSECRETARÍA DE EDUCACIÓN MEDIA Y SUPERIOR",
        centerX,
        22,
        { align: "center" }
      );
      doc.text("DIRECCIÓN DE EDUCACIÓN SUPERIOR", centerX, 30, {
        align: "center",
      });
      doc.text("COORDINACIÓN DE ESCUELAS NORMALES, IESMA Y UPN", centerX, 38, {
        align: "center",
      });

      doc.setFont("Montserrat-BoldItalic", "bolditalic");
      doc.setFontSize(7.4);
      const headerInfoFontSize = 7.4;

      function drawMixedCenteredLine(y, segments, fontSize = headerInfoFontSize) {
        let totalWidth = 0;
        for (const segment of segments) {
          doc.setFont(segment.font, segment.fontStyle);
          doc.setFontSize(fontSize);
          totalWidth += doc.getTextWidth(segment.text);
        }

        let x = centerX - totalWidth / 2;
        for (const segment of segments) {
          doc.setFont(segment.font, segment.fontStyle);
          doc.setFontSize(fontSize);
          doc.text(segment.text, x, y);
          x += doc.getTextWidth(segment.text);
        }
      }

      drawMixedCenteredLine(50, [
        { text: "ESCUELA:", font: "Montserrat-Bold", fontStyle: "bold" },
        { text: " NORMAL URBANA | ", font: "Montserrat-Regular", fontStyle: "normal" },
        { text: "PLAN DE ESTUDIOS:", font: "Montserrat-Bold", fontStyle: "bold" },
        { text: " 2022 | ", font: "Montserrat-Regular", fontStyle: "normal" },
        { text: "C.C.T.:", font: "Montserrat-Bold", fontStyle: "bold" },
        { text: " 27DNL0001K | ", font: "Montserrat-Regular", fontStyle: "normal" },
        { text: "MODALIDAD:", font: "Montserrat-Bold", fontStyle: "bold" },
        { text: " ESCOLARIZADA", font: "Montserrat-Regular", fontStyle: "normal" },
      ]);

      drawMixedCenteredLine(60, [
        { text: "LICENCIATURA:", font: "Montserrat-Bold", fontStyle: "bold" },
        {
          text: " EN EDUCACIÓN PRIMARIA Y PREESCOLAR | ",
          font: "Montserrat-Regular",
          fontStyle: "normal",
        },
        { text: "TURNO:", font: "Montserrat-Bold", fontStyle: "bold" },
        { text: " MATUTINO | ", font: "Montserrat-Regular", fontStyle: "normal" },
        { text: "CICLO ESCOLAR:", font: "Montserrat-Bold", fontStyle: "bold" },
        {
          text: ` ${semester?.[0]?.school_year ?? ""}`,
          font: "Montserrat-Regular",
          fontStyle: "normal",
        },
      ]);

      drawMixedCenteredLine(70, [
        { text: "DIRECCIÓN:", font: "Montserrat-Bold", fontStyle: "bold" },
        {
          text: " PERIFÉRICO S/N COL. LAS FLORES | ",
          font: "Montserrat-Regular",
          fontStyle: "normal",
        },
        { text: "MUNICIPIO:", font: "Montserrat-Bold", fontStyle: "bold" },
        { text: " BALANCÁN, TABASCO.", font: "Montserrat-Regular", fontStyle: "normal" },
      ]);

      const footerTopY = pageHeight - 84;
      const lineHeight = 10;

      function drawCenteredWrappedText(text, x, y, maxWidth) {
        const lines = doc.splitTextToSize(text, maxWidth);
        lines.forEach((line, index) => {
          doc.text(line, x, y + index * lineHeight, { align: "center" });
        });
      }

      doc.setFont("Montserrat-BoldItalic", "bolditalic");
      doc.setFontSize(9);
      doc.text("VO. BO.", pageWidth - 150, footerTopY, { align: "center" });
      doc.text("SELLO", pageWidth - 36, footerTopY, { align: "center" });

      const rightLineStartX = pageWidth - 220;
      const rightLineEndX = pageWidth - 72;
      const lineY = footerTopY + 16;
      doc.setDrawColor(90);
      doc.line(rightLineStartX, lineY, rightLineEndX, lineY);

      doc.setFont("Montserrat-BoldItalic", "bolditalic");
      doc.setFontSize(8.2);
      drawCenteredWrappedText(leftFooterName, 125, footerTopY + 24, 220);
      drawCenteredWrappedText(leftFooterTitle, 125, footerTopY + 35, 220);

      drawCenteredWrappedText(
        rightFooterName,
        pageWidth - 146,
        footerTopY + 24,
        220
      );
      drawCenteredWrappedText(
        rightFooterTitle,
        pageWidth - 146,
        footerTopY + 35,
        230
      );
    }

    const columns = [
      [
        { content: "PROG", rowSpan: 2 },
        {
          content:
            "NOMBRE, DOMICILIO, FECHA DE INGRESO,\nCORREO ELÉCTRONICO, TELÉFONO",
          rowSpan: 2,
        },
        { content: "RFC", rowSpan: 2 },
        { content: "SOST", rowSpan: 2 },
        { content: "PLAZA Y CLAVE\nDE PAGO", rowSpan: 2 },
        {
          content: "PREPARACIÓN PROFESIONAL\n(ESPECIALIDAD)",
          rowSpan: 2,
        },
        {
          content: "ASIGNATURA QUE IMPARTE\n(GRADO Y GRUPO)",
          rowSpan: 2,
        },
        { content: "HRS.\nFRENTE A\nGRUPO", rowSpan: 2 },
        { content: "DESCARGA ACADÉMICA", colSpan: 3 },
        { content: "FOTOS", rowSpan: 2 },
        { content: "FIRMA", rowSpan: 2 },
        { content: "OBS.", rowSpan: 2 },
      ],
      ["FUNCIÓN QUE\nDESEMPEÑA", "NO. DE\nHORAS", "TOTAL DE\nHORAS"],
    ];

    const columnStyles = {
      0: { cellWidth: 14, halign: "center" },
      1: { cellWidth: 108 },
      2: { cellWidth: 40 },
      3: { cellWidth: 20, halign: "center" },
      4: { cellWidth: 50 },
      5: { cellWidth: 62 },
      6: { cellWidth: 76 },
      7: { cellWidth: 22, halign: "center" },
      8: { cellWidth: 50 },
      9: { cellWidth: 20, halign: "center" },
      10: { cellWidth: 20, halign: "center" },
      11: { cellWidth: 24, halign: "center" },
      12: { cellWidth: 24, halign: "center" },
      13: { cellWidth: 34 },
    };

    doc.autoTable({
      styles: {
        halign: "left",
        valign: "middle",
        font: "Montserrat-Regular",
        fontSize: 5.5,
        overflow: "linebreak",
        cellPadding: { top: 1.2, right: 1.4, bottom: 1.2, left: 1.4 },
      },
      headStyles: {
        fillColor: [0, 0, 0],
        font: "Montserrat-Bold",
        halign: "center",
        valign: "middle",
        fontSize: 5.6,
      },
      margin: tableMargins,
      tableWidth: "auto",
      rowPageBreak: "avoid",
      columnStyles,
      head: columns,
      body: teacherWorkers.map((worker) => {
        // Extract the subjects from current semester
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

        const functionPerformedText = normalizeMultilineText(
          buildFunctionPerformedText(
            worker.function_performed,
            uniqueTeacherSchedule
          )
        );

        return [
          worker.id,
          normalizeMultilineText(`${worker.name}
  CALLE: ${worker.street}
  ${worker.neighborhood}
  TEL: ${worker.phone}
  C.P: ${worker.post_code}
  ${worker.city}, ${worker.state}
  ${worker.email === null ? "" : worker.email}
  ${worker.date_of_admissions.map(
    (date) => ` ${date.type}: ${transformDate(date.date_of_admission)}`
  )}`),
          worker.RFC,
          normalizeMultilineText(`${worker.sustenance_plazas.map(
            ({ sustenance }) => `
  ${sustenance}`
          )}`),
          normalizeMultilineText(`${worker.sustenance_plazas.map(
            ({ payment_key, plaza }) => `
  ${payment_key}
  ${plaza}`
          )}`),
          worker.specialty,
          normalizeMultilineText(Object.keys(groupedSubjects).map(
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
          )).toLocaleUpperCase("es-MX"),
          `${numHours > 0 ? numHours : ""}`,
          functionPerformedText,
          `${numHours > 0 ? numHours : ""}`,
          `${totalHours > 2 ? totalHours : ""}`,
          "",
          "",
          worker.observations,
        ];
      }),
      theme: "grid",
      didDrawCell: function (data) {
        if (data.column.index === 11 && data.cell.section === "body") {
          if (data.row.index !== -1) {
            drawWorkerPhotoInCell(
              data,
              teacherWorkers[data.row.index].profile_picture
            );
          }
        }
      },
      didDrawPage: drawPageHeaderFooter,
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
      margin: tableMargins,
      didDrawPage: drawPageHeaderFooter,
    });

    doc.autoTable({
      styles: {
        halign: "left",
        valign: "middle",
        font: "Montserrat-Regular",
        fontSize: 5.5,
        overflow: "linebreak",
        cellPadding: { top: 1.2, right: 1.4, bottom: 1.2, left: 1.4 },
      },
      headStyles: {
        fillColor: [0, 0, 0],
        font: "Montserrat-Bold",
        halign: "center",
        valign: "middle",
        fontSize: 5.6,
      },
      margin: tableMargins,
      tableWidth: "auto",
      rowPageBreak: "avoid",
      columnStyles,
      head: columns,
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

        const functionPerformedText = normalizeMultilineText(
          buildFunctionPerformedText(
            worker.function_performed,
            uniqueTeacherSchedule
          )
        );

        return [
          worker.id,
          normalizeMultilineText(`${worker.name}
  CALLE: ${worker.street}
  ${worker.neighborhood}
  TEL: ${worker.phone}
  C.P: ${worker.post_code}
  ${worker.city}, ${worker.state}
  ${worker.email === null ? "" : worker.email}
  ${worker.date_of_admissions.map(
    (date) => ` ${date.type}: ${transformDate(date.date_of_admission)}`
  )}`),
          worker.RFC,
          normalizeMultilineText(`${worker.sustenance_plazas.map(
            ({ sustenance }) => `
  ${sustenance}`
          )}`),
          normalizeMultilineText(`${worker.sustenance_plazas.map(
            ({ payment_key, plaza }) => `
  ${payment_key}
  ${plaza}`
          )}`),
          worker.specialty,
          normalizeMultilineText(Object.keys(groupedSubjects).map(
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
          )).toLocaleUpperCase("es-MX"),
          `${numHours > 0 ? numHours : ""}`,
          functionPerformedText,
          `${numHours > 0 ? numHours : ""}`,
          `${totalHours > 2 ? totalHours : ""}`,
          "",
          "",
          worker.observations,
        ];
      }),
      theme: "grid",
      didDrawCell: function (data) {
        if (data.column.index === 11 && data.cell.section === "body") {
          if (data.row.index !== -1) {
            drawWorkerPhotoInCell(
              data,
              administrativeWorkers[data.row.index].profile_picture
            );
          }
        }
      },
      didDrawPage: drawPageHeaderFooter,
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
      margin: tableMargins,
      didDrawPage: drawPageHeaderFooter,
    });

    doc.autoTable({
      styles: {
        halign: "left",
        valign: "middle",
        font: "Montserrat-Regular",
        fontSize: 5.5,
        overflow: "linebreak",
        cellPadding: { top: 1.2, right: 1.4, bottom: 1.2, left: 1.4 },
      },
      headStyles: {
        fillColor: [0, 0, 0],
        font: "Montserrat-Bold",
        halign: "center",
        valign: "middle",
        fontSize: 5.6,
      },
      margin: tableMargins,
      tableWidth: "auto",
      rowPageBreak: "avoid",
      columnStyles,
      head: columns,
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

        const functionPerformedText = normalizeMultilineText(
          buildFunctionPerformedText(
            worker.function_performed,
            uniqueTeacherSchedule
          )
        );

        return [
          worker.id,
          normalizeMultilineText(`${worker.name}
  CALLE: ${worker.street}
  ${worker.neighborhood}
  TEL: ${worker.phone}
  C.P: ${worker.post_code}
  ${worker.city}, ${worker.state}
  ${worker.email === null ? "" : worker.email}
  ${worker.date_of_admissions.map(
    (date) => ` ${date.type}: ${transformDate(date.date_of_admission)}`
  )}`),
          worker.RFC,
          normalizeMultilineText(`${worker.sustenance_plazas.map(
            ({ sustenance }) => `
  ${sustenance}`
          )}`),
          normalizeMultilineText(`${worker.sustenance_plazas.map(
            ({ payment_key, plaza }) => `
  ${payment_key}
  ${plaza}`
          )}`),
          worker.specialty,
          normalizeMultilineText(Object.keys(groupedSubjects).map(
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
          )).toLocaleUpperCase("es-MX"),
          `${numHours > 0 ? numHours : ""}`,
          functionPerformedText,
          `${numHours > 0 ? numHours : ""}`,
          `${totalHours > 2 ? totalHours : ""}`,
          "",
          "",
          worker.observations,
        ];
      }),
      theme: "grid",
      didDrawCell: function (data) {
        if (data.column.index === 11 && data.cell.section === "body") {
          if (data.row.index !== -1) {
            drawWorkerPhotoInCell(
              data,
              hiringWorkers[data.row.index].profile_picture
            );
          }
        }
      },
      didDrawPage: drawPageHeaderFooter,
    });

    const blobUrl = doc.output("bloburl");
    const previewWindow = window.open(blobUrl, "_blank");
    if (!previewWindow) doc.save("Plantilla.pdf");
  };

  if (isLoadingRoles) return <Spinner />;

  return <Button onClick={generatePDF}>Imprimir plantilla académica</Button>;
}

export default WorkerSheetSemester;
