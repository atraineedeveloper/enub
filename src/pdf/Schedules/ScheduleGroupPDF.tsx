import jsPDF from "jspdf";
import "jspdf-autotable";
import Button from "../../ui/Button";
import { useRoles } from "../../features/roles/useRoles";
import { useStateRoles } from "../../features/stateRoles/useStateRoles";
import filterHour from "./filterHour";
import calculateSemesterGroup from "../../helpers/calculateSemesterGroup";
import { useUtilities } from "../../features/otherData/useUtilities";

function ScheduleGroupPDF({ schedules }: { schedules: any[] }) {
  const { isLoading: isLoadingRoles, roles } = useRoles();
  const { isLoading: isLoadingStateRoles, stateRoles } = useStateRoles();
  const { isLoading: isLoadingUtilities, utilities } = useUtilities();

  const generatePDF = async () => {
    await import("../../styles/Montserrat-Regular-normal.js");
    await import("../../styles/Montserrat-Italic-italic.js");
    await import("../../styles/Montserrat-Bold-bold.js");
    await import("../../styles/Montserrat-BoldItalic-bolditalic.js");

    const doc = new jsPDF("p", "px", "letter");

    const infoGroup = [
      [
        "ESCUELA NORMAL URBANA",
        `PERIODO ESCOLAR: ${schedules[0].semesters.school_year}`,
      ],
      [schedules[0].groups.degrees.name.toUpperCase(), `PLAN: 2022`],
      [
        `SEMESTRE: ${calculateSemesterGroup(
          schedules[0].groups.year_of_admission
        )}°    GRUPO: ${schedules[0].groups.letter}`,
        `TURNO: MATUTINO`,
      ],
    ];

    const columns = ["", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES"];
    const data = [
      [
        "7:00 - 8:50",
        "Homenaje / Tutoria",
        filterHour(schedules, "Martes", "07:00:00"),
        filterHour(schedules, "Miercoles", "07:00:00"),
        filterHour(schedules, "Jueves", "07:00:00"),
        filterHour(schedules, "Viernes", "07:00:00"),
      ],
      [
        "8:50 - 9:20",
        { content: "RECESO", colSpan: 5, styles: { halign: "center" } },
      ],
      [
        "9:20 - 11:10",
        filterHour(schedules, "Lunes", "09:20:00"),
        filterHour(schedules, "Martes", "09:20:00"),
        filterHour(schedules, "Miercoles", "09:20:00"),
        filterHour(schedules, "Jueves", "09:20:00"),
        filterHour(schedules, "Viernes", "09:20:00"),
      ],
      [
        "11:10 - 13:00",
        filterHour(schedules, "Lunes", "11:10:00"),
        filterHour(schedules, "Martes", "11:10:00"),
        filterHour(schedules, "Miercoles", "11:10:00"),
        filterHour(schedules, "Jueves", "11:10:00"),
        filterHour(schedules, "Viernes", "11:10:00"),
      ],
      [
        "13:00 - 13:10",
        { content: "RECESO", colSpan: 5, styles: { halign: "center" } },
      ],
      [
        "13:10 - 15:00",
        filterHour(schedules, "Lunes", "13:10:00"),
        filterHour(schedules, "Martes", "13:10:00"),
        filterHour(schedules, "Miercoles", "13:10:00"),
        filterHour(schedules, "Jueves", "13:10:00"),
        filterHour(schedules, "Viernes", "13:10:00"),
      ],
    ];

    // Header

    const logoEnub = new Image();
    logoEnub.src = "/enub.jpg";
    doc.addImage(logoEnub, "JPG", 380, 10, 50, 50);

    const logoSetab = new Image();
    logoSetab.src = "/setab.jpeg";
    doc.addImage(logoSetab, "JPEG", 30, 5, 60, 60);

    doc.autoTable({
      willDrawPage: function (data: any) {
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
      didDrawPage: function (data: any) {
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
      margin: { top: 60, bottom: 80 },
    });

    // Info group
    doc.autoTable({
      body: infoGroup,
      theme: "plain",
      styles: {
        fontSize: 9,
        font: "Montserrat-Bold",
        fontStyle: "bold",
        halign: "center",
      },
      columnStyles: {
        0: { halign: "left" },
        1: { halign: "right" },
      },
      margin: { top: 60 },
    });

    // Schedule
    doc.autoTable({
      head: [columns],
      body: data,
      theme: "grid",
      styles: {
        fontSize: 8,
        font: "Montserrat-Regular",
        halign: "center",
        valign: "middle",
        lineWidth: 0.1,
        lineColor: [0, 0, 0],
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        font: "Montserrat-Bold",
        fontStyle: "bold",
      },
      columnStyles: {
        0: { cellWidth: 40 },
      },
    });

    // Signatures
    doc.autoTable({
      body: [
        [
          "\n\n\n__________________________________\nELABORÓ",
          "\n\n\n__________________________________\nAUTORIZÓ",
          "\n\n\n__________________________________\nVo. Bo.",
        ],
        [
          utilities?.[0]?.made_by || "",
          utilities?.[0]?.authorized_by || "",
          utilities?.[0]?.vo_bo || "",
        ],
        [
          "CONTROL ESCOLAR",
          "SUBDIRECTOR ACADÉMICO",
          "DIRECTORA DE LA ESCUELA",
        ],
      ],
      theme: "plain",
      styles: {
        fontSize: 8,
        font: "Montserrat-Regular",
        halign: "center",
        valign: "bottom",
      },
      margin: { top: 40 },
    });

    doc.save(`Horario ${schedules[0].groups.letter}.pdf`);
  };

  if (isLoadingRoles || isLoadingStateRoles || isLoadingUtilities) return null;

  return (
    <Button onClick={generatePDF} size="small" variation="secondary">
      Descargar PDF
    </Button>
  );
}

export default ScheduleGroupPDF;
