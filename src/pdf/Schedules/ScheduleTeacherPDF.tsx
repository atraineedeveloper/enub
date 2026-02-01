import jsPDF from "jspdf";
import "jspdf-autotable";
import Button from "../../ui/Button";
import { useRoles } from "../../features/roles/useRoles";
import { useStateRoles } from "../../features/stateRoles/useStateRoles";
import filterHourGroup from "./filterHourGroup";
import filterHourActivity from "./filterHourActivity";
import { useUtilities } from "../../features/otherData/useUtilities";

function ScheduleTeacherPDF({
  schedulesScholar,
  scheduleTeacher,
  totalHours,
}: {
  schedulesScholar: any[];
  scheduleTeacher: any[];
  totalHours?: any;
}) {
  const { isLoading: isLoadingRoles, roles } = useRoles();
  const { isLoading: isLoadingStateRoles, stateRoles } = useStateRoles();
  const { isLoading: isLoadingUtilities, utilities } = useUtilities();

  let hasExtraHours = false;

  let numberLEPRIM = 0,
    numberLEPREES = 0;

  let titleDegrees: string;

  const afternoonSchedule = schedulesScholar.filter((schedule) => {
    return schedule.start_time === "17:00:00";
  });

  const afternoonActivity = scheduleTeacher.filter((schedule) => {
    return schedule.start_time === "17:00:00";
  });

  if (afternoonSchedule.length > 0 || afternoonActivity.length > 0) {
    hasExtraHours = true;
  }

  schedulesScholar.map((schedule) => {
    if (schedule.groups.degrees.code == "LEPRIM") {
      numberLEPRIM++;
    } else if (schedule.groups.degrees.code == "LEPREES") {
      numberLEPREES++;
    }
  });

  if (numberLEPRIM > 0 && numberLEPREES > 0) {
    titleDegrees = "EDUCACIÓN PRIMARIA Y PREESCOLAR";
  } else if (numberLEPRIM > 0) {
    titleDegrees = "EDUCACIÓN PRIMARIA";
  } else if (numberLEPREES > 0) {
    titleDegrees = "EDUCACIÓN PREESCOLAR";
  } else {
    titleDegrees = "EDUCACIÓN EN PRIMARIA";
  }

  const generatePDF = async () => {
    await import("../../styles/Montserrat-Regular-normal.js");
    await import("../../styles/Montserrat-Italic-italic.js");
    await import("../../styles/Montserrat-Bold-bold.js");
    await import("../../styles/Montserrat-BoldItalic-bolditalic.js");

    const doc = new jsPDF("p", "px", "letter");

    // Header

    doc.autoTable({
      willDrawPage: function (data: any) {
        // Header
        const logoEnub = new Image();
        logoEnub.src = "/enub.jpg";
        doc.addImage(logoEnub, "JPG", 380, 10, 50, 50);

        const logoSetab = new Image();
        logoSetab.src = "/setab.jpeg";
        doc.addImage(logoSetab, "JPEG", 30, 5, 60, 60);

        const pageWidth =
          doc.internal.pageSize.width || doc.internal.pageSize.getWidth();

        doc.setFont("Montserrat-Italic", "italic");
        doc.setFontSize(8);
        doc.setTextColor(0, 0, 0);
        
        let text = "SECRETARÍA DE EDUCACIÓN";
        let textWidth = doc.getTextWidth(text);
        doc.text(text, (pageWidth - textWidth) / 2, 15);

        text = "SUBSECRETARÍA DE EDUCACIÓN MEDIA Y SUPERIOR";
        textWidth = doc.getTextWidth(text);
        doc.text(text, (pageWidth - textWidth) / 2, 25);

        doc.setFont("Montserrat-Bold", "bold");
        doc.setFontSize(10);
        text = "ESCUELA NORMAL URBANA DE BALANCÁN";
        textWidth = doc.getTextWidth(text);
        doc.text(text, (pageWidth - textWidth) / 2, 35);

        doc.setFont("Montserrat-Regular", "normal");
        doc.setFontSize(8);
        text = "CLAVE: 27DNL0004D";
        textWidth = doc.getTextWidth(text);
        doc.text(text, (pageWidth - textWidth) / 2, 45);

        doc.setFont("Montserrat-BoldItalic", "bolditalic");
        doc.setFontSize(10);
        text = "\"APRENDER PARA ENSEÑAR\"";
        textWidth = doc.getTextWidth(text);
        doc.text(text, (pageWidth - textWidth) / 2, 55);
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

    const infoTeacher = [
      [`LICENCIATURA EN ${titleDegrees}`, `PERIODO ESCOLAR: ${schedulesScholar[0]?.semesters?.school_year || ""}`],
      [`DOCENTE: ${schedulesScholar[0]?.workers?.name || ""}`, `PLAN: ${schedulesScholar[0]?.subjects?.study_programs?.year || "2022"}`],
      ["TURNO: MATUTINO", ""],
    ];

    doc.autoTable({
      body: infoTeacher,
      theme: "plain",
      styles: {
        fontSize: 10,
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

    const columns = ["", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES"];
    
    // Combine scholar and activity schedules for filter
    const allSchedules = [...schedulesScholar, ...scheduleTeacher];
    // This is a simplification. The original code seemed to rely on filterHourGroup/Activity 
    // knowing which array to filter. But here we have two arrays.
    // Actually, filterHourGroup expects scholar schedules and filterHourActivity expects teacher/activity schedules.
    // The previous implementation imported them separately.
    // I need to use them appropriately in the data array.

    const data = [
      [
        "7:00 - 8:50",
        filterHourGroup(schedulesScholar, "Lunes", "07:00:00") || filterHourActivity(scheduleTeacher, "Lunes", "07:00:00"),
        filterHourGroup(schedulesScholar, "Martes", "07:00:00") || filterHourActivity(scheduleTeacher, "Martes", "07:00:00"),
        filterHourGroup(schedulesScholar, "Miercoles", "07:00:00") || filterHourActivity(scheduleTeacher, "Miercoles", "07:00:00"),
        filterHourGroup(schedulesScholar, "Jueves", "07:00:00") || filterHourActivity(scheduleTeacher, "Jueves", "07:00:00"),
        filterHourGroup(schedulesScholar, "Viernes", "07:00:00") || filterHourActivity(scheduleTeacher, "Viernes", "07:00:00"),
      ],
      [
        "8:50 - 9:20",
        { content: "RECESO", colSpan: 5, styles: { halign: "center" } },
      ],
      [
        "9:20 - 11:10",
        filterHourGroup(schedulesScholar, "Lunes", "09:20:00") || filterHourActivity(scheduleTeacher, "Lunes", "09:20:00"),
        filterHourGroup(schedulesScholar, "Martes", "09:20:00") || filterHourActivity(scheduleTeacher, "Martes", "09:20:00"),
        filterHourGroup(schedulesScholar, "Miercoles", "09:20:00") || filterHourActivity(scheduleTeacher, "Miercoles", "09:20:00"),
        filterHourGroup(schedulesScholar, "Jueves", "09:20:00") || filterHourActivity(scheduleTeacher, "Jueves", "09:20:00"),
        filterHourGroup(schedulesScholar, "Viernes", "09:20:00") || filterHourActivity(scheduleTeacher, "Viernes", "09:20:00"),
      ],
      [
        "11:10 - 13:00",
        filterHourGroup(schedulesScholar, "Lunes", "11:10:00") || filterHourActivity(scheduleTeacher, "Lunes", "11:10:00"),
        filterHourGroup(schedulesScholar, "Martes", "11:10:00") || filterHourActivity(scheduleTeacher, "Martes", "11:10:00"),
        filterHourGroup(schedulesScholar, "Miercoles", "11:10:00") || filterHourActivity(scheduleTeacher, "Miercoles", "11:10:00"),
        filterHourGroup(schedulesScholar, "Jueves", "11:10:00") || filterHourActivity(scheduleTeacher, "Jueves", "11:10:00"),
        filterHourGroup(schedulesScholar, "Viernes", "11:10:00") || filterHourActivity(scheduleTeacher, "Viernes", "11:10:00"),
      ],
      [
        "13:00 - 13:10",
        { content: "RECESO", colSpan: 5, styles: { halign: "center" } },
      ],
      [
        "13:10 - 15:00",
        filterHourGroup(schedulesScholar, "Lunes", "13:10:00") || filterHourActivity(scheduleTeacher, "Lunes", "13:10:00"),
        filterHourGroup(schedulesScholar, "Martes", "13:10:00") || filterHourActivity(scheduleTeacher, "Martes", "13:10:00"),
        filterHourGroup(schedulesScholar, "Miercoles", "13:10:00") || filterHourActivity(scheduleTeacher, "Miercoles", "13:10:00"),
        filterHourGroup(schedulesScholar, "Jueves", "13:10:00") || filterHourActivity(scheduleTeacher, "Jueves", "13:10:00"),
        filterHourGroup(schedulesScholar, "Viernes", "13:10:00") || filterHourActivity(scheduleTeacher, "Viernes", "13:10:00"),
      ],
    ];

    if (hasExtraHours) {
      data.push([
        "17:00 - 18:00",
        filterHourGroup(schedulesScholar, "Lunes", "17:00:00") || filterHourActivity(scheduleTeacher, "Lunes", "17:00:00"),
        filterHourGroup(schedulesScholar, "Martes", "17:00:00") || filterHourActivity(scheduleTeacher, "Martes", "17:00:00"),
        filterHourGroup(schedulesScholar, "Miercoles", "17:00:00") || filterHourActivity(scheduleTeacher, "Miercoles", "17:00:00"),
        filterHourGroup(schedulesScholar, "Jueves", "17:00:00") || filterHourActivity(scheduleTeacher, "Jueves", "17:00:00"),
        filterHourGroup(schedulesScholar, "Viernes", "17:00:00") || filterHourActivity(scheduleTeacher, "Viernes", "17:00:00"),
      ]);
    }

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

    doc.save(`Horario ${schedulesScholar[0]?.workers?.name}.pdf`);
  };

  if (isLoadingRoles || isLoadingStateRoles || isLoadingUtilities) return null;

  return (
    <Button onClick={generatePDF} size="small" variation="secondary">
      Descargar PDF
    </Button>
  );
}

export default ScheduleTeacherPDF;
