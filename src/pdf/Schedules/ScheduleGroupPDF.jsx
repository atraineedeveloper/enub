import jsPDF from "jspdf";
import "jspdf-autotable";
import Button from "../../ui/Button.jsx";
import { useRoles } from "../../features/roles/useRoles.js";
import { useStateRoles } from "../../features/stateRoles/useStateRoles.js";
import Spinner from "../../ui/Spinner.jsx";
import filterHour from "./filterHour.js";
import calculateSemesterGroup from "../../helpers/calculateSemesterGroup.js";
import capitalizeName from "../../helpers/capitalizeFirstLetter.js";
import { useUtilities } from "../../features/otherData/useUtilities.js";

function ScheduleGroupPDF({ schedules }) {
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
        // jsPDF 1.4+ uses getHeight, <1.4 uses .height
        var pageSize = doc.internal.pageSize;
        var pageHeight = pageSize.height
          ? pageSize.height
          : pageSize.getHeight();

        doc.setFont("Montserrat-Regular");
        doc.setFontSize(8);
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
      margin: { top: 50 },
    });

    // Information about groups

    doc.autoTable({
      styles: {
        valign: "middle",
        font: "Montserrat-Bold",
        fontSize: 9,
      },
      body: infoGroup,
      theme: "plain",
    });

    // Schedule of the group

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
        0: { cellWidth: 50 },
      },
      head: [columns],
      body: data,
      theme: "grid",
    });

    const infoSchool = [
      ["", "", `Balancán, Tabasco a ${utilities[0].value}`],
      [
        {
          content: roles[1].role,
          styles: { font: "Montserrat-Bold" },
        },
        {
          content: "Vo. Bo",
          rowSpan: 4,
          styles: { halign: "center" },
        },
        {
          content: roles[0].role,
          styles: { font: "Montserrat-Bold" },
        },
      ],
      [
        capitalizeName(roles[1].workers.name),
        capitalizeName(roles[0].workers.name),
      ],
      [
        {
          content: stateRoles[0].role,
          styles: { font: "Montserrat-Bold" },
        },
        {
          content: stateRoles[1].role,
          styles: { font: "Montserrat-Bold" },
        },
      ],
      [
        capitalizeName(stateRoles[0].name_worker.toUpperCase()),
        capitalizeName(stateRoles[1].name_worker.toUpperCase()),
      ],
    ];

    doc.autoTable({
      styles: {
        halign: "center",
        valign: "middle",
        font: "Montserrat-Regular",
        fontSize: 9,
      },
      body: infoSchool,
      theme: "plain",
    });

    doc.output("dataurlnewwindow");
  };

  // console.log(schedules);

  if (isLoadingRoles || isLoadingStateRoles || isLoadingUtilities)
    return <Spinner />;

  return (
    <Button variation="secondary" onClick={generatePDF}>
      Generar horario grupal
    </Button>
  );
}

export default ScheduleGroupPDF;
