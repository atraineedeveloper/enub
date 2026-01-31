import jsPDF from "jspdf";
import "jspdf-autotable";
import Button from "../../ui/Button.jsx";
import Spinner from "../../ui/Spinner.jsx";
import { useRoles } from "../../features/roles/useRoles.js";
import { useStateRoles } from "../../features/stateRoles/useStateRoles.js";
import filterHourGroup from "./filterHourGroup.js";
import filterHourActivity from "./filterHourActivity.js";
import capitalizeName from "../../helpers/capitalizeFirstLetter.js";
import { useUtilities } from "../../features/otherData/useUtilities.js";

function ScheduleTeacherPDF({ schedulesScholar, scheduleTeacher, totalHours }) {
  const { isLoading: isLoadingRoles, roles } = useRoles();
  const { isLoading: isLoadingStateRoles, stateRoles } = useStateRoles();
  const { isLoading: isLoadingUtilities, utilities } = useUtilities();

  let hasExtraHours = false;

  let numberLEPRIM = 0,
    numberLEPREES = 0;

  let titleDegrees;

  const afternoonSchedule = schedulesScholar.filter((schedule) => {
    return schedule.start_time === "17:00:00";
  });

  const afternoonActivity = scheduleTeacher.filter((schedule) => {
    return schedule.start_time === "17:00:00";
  });

  if (afternoonSchedule.length > 0 || afternoonActivity.length > 0) {
    hasExtraHours = true;
  }

  // console.log(schedulesScholar, scheduleTeacher);

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
      margin: { top: 50 },
    });

    const infoGroup = [
      [
        "ESCUELA NORMAL URBANA",
        `PERIODO ESCOLAR: ${
          schedulesScholar[0]?.semesters.school_year ||
          scheduleTeacher[0].semesters.school_year
        }`,
      ],
      [`LICENCIATURA EN ${titleDegrees}`, `PLAN: 2022`],
      [
        `DOCENTE: ${capitalizeName(
          schedulesScholar[0]?.workers.name || scheduleTeacher[0].workers.name
        )}`,
        `TURNO: MATUTINO`,
      ],
    ];

    doc.autoTable({
      styles: {
        valign: "middle",
        font: "Montserrat-Bold",
        fontSize: 9,
      },
      body: infoGroup,
      theme: "plain",
    });

    let horarioTutoria40Hours = "";

    if (totalHours === 40) {
      horarioTutoria40Hours = "Homenaje / Tutoria";
    }

    const columns = ["", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES"];
    const data = [
      [
        "7:00 - 8:50",
        horarioTutoria40Hours,
        `${filterHourGroup(
          schedulesScholar,
          "Martes",
          "07:00:00"
        )}${filterHourActivity(scheduleTeacher, "Martes", "07:00:00")}`,
        `${filterHourGroup(
          schedulesScholar,
          "Miercoles",
          "07:00:00"
        )}${filterHourActivity(scheduleTeacher, "Miercoles", "07:00:00")}`,
        `${filterHourGroup(
          schedulesScholar,
          "Jueves",
          "07:00:00"
        )}${filterHourActivity(scheduleTeacher, "Jueves", "07:00:00")}`,
        `${filterHourGroup(
          schedulesScholar,
          "Viernes",
          "07:00:00"
        )}${filterHourActivity(scheduleTeacher, "Viernes", "07:00:00")}`,
      ],
      [
        "8:50 - 9:20",
        { content: "RECESO", colSpan: 5, styles: { halign: "center" } },
      ],
      [
        "9:20 - 11:10",
        `${filterHourGroup(
          schedulesScholar,
          "Lunes",
          "09:20:00"
        )}${filterHourActivity(scheduleTeacher, "Lunes", "09:20:00")}`,
        `${filterHourGroup(
          schedulesScholar,
          "Martes",
          "09:20:00"
        )}${filterHourActivity(scheduleTeacher, "Martes", "09:20:00")}`,
        `${filterHourGroup(
          schedulesScholar,
          "Miercoles",
          "09:20:00"
        )}${filterHourActivity(scheduleTeacher, "Miercoles", "09:20:00")}`,
        `${filterHourGroup(
          schedulesScholar,
          "Jueves",
          "09:20:00"
        )}${filterHourActivity(scheduleTeacher, "Jueves", "09:20:00")}`,
        `${filterHourGroup(
          schedulesScholar,
          "Viernes",
          "09:20:00"
        )}${filterHourActivity(scheduleTeacher, "Viernes", "09:20:00")}`,
      ],
      [
        "11:10 - 13:00",
        `${filterHourGroup(
          schedulesScholar,
          "Lunes",
          "11:10:00"
        )}${filterHourActivity(scheduleTeacher, "Lunes", "11:10:00")}`,
        `${filterHourGroup(
          schedulesScholar,
          "Martes",
          "11:10:00"
        )}${filterHourActivity(scheduleTeacher, "Martes", "11:10:00")}`,
        `${filterHourGroup(
          schedulesScholar,
          "Miercoles",
          "11:10:00"
        )}${filterHourActivity(scheduleTeacher, "Miercoles", "11:10:00")}`,
        `${filterHourGroup(
          schedulesScholar,
          "Jueves",
          "11:10:00"
        )}${filterHourActivity(scheduleTeacher, "Jueves", "11:10:00")}`,
        `${filterHourGroup(
          schedulesScholar,
          "Viernes",
          "11:10:00"
        )}${filterHourActivity(scheduleTeacher, "Viernes", "11:10:00")}`,
      ],
      [
        "13:00 - 13:10",
        { content: "RECESO", colSpan: 5, styles: { halign: "center" } },
      ],
      [
        "13:10 - 15:00",
        `${filterHourGroup(
          schedulesScholar,
          "Lunes",
          "13:10:00"
        )}${filterHourActivity(scheduleTeacher, "Lunes", "13:10:00")}`,
        `${filterHourGroup(
          schedulesScholar,
          "Martes",
          "13:10:00"
        )}${filterHourActivity(scheduleTeacher, "Martes", "13:10:00")}`,
        `${filterHourGroup(
          schedulesScholar,
          "Miercoles",
          "13:10:00"
        )}${filterHourActivity(scheduleTeacher, "Miercoles", "13:10:00")}`,
        `${filterHourGroup(
          schedulesScholar,
          "Jueves",
          "13:10:00"
        )}${filterHourActivity(scheduleTeacher, "Jueves", "13:10:00")}`,
        `${filterHourGroup(
          schedulesScholar,
          "Viernes",
          "13:10:00"
        )}${filterHourActivity(scheduleTeacher, "Viernes", "13:10:00")}`,
      ],
    ];

    // ==========ADD EXTRA HOURS IF THERE'S SOME ==============

    const extraHours1 = [
      {
        content: "HORARIO EXTRACURRICULAR",
        colSpan: 6,
        styles: { halign: "center" },
      },
    ];

    const extraHours2 = [
      "17:00 - 19:00",
      `${filterHourGroup(
        schedulesScholar,
        "Lunes",
        "17:00:00"
      )}${filterHourActivity(scheduleTeacher, "Lunes", "17:00:00")}`,
      `${filterHourGroup(
        schedulesScholar,
        "Martes",
        "17:00:00"
      )}${filterHourActivity(scheduleTeacher, "Martes", "17:00:00")}`,
      `${filterHourGroup(
        schedulesScholar,
        "Miercoles",
        "17:00:00"
      )}${filterHourActivity(scheduleTeacher, "Miercoles", "17:00:00")}`,
      `${filterHourGroup(
        schedulesScholar,
        "Jueves",
        "17:00:00"
      )}${filterHourActivity(scheduleTeacher, "Jueves", "17:00:00")}`,
      `${filterHourGroup(
        schedulesScholar,
        "Viernes",
        "17:00:00"
      )}${filterHourActivity(scheduleTeacher, "Viernes", "17:00:00")}`,
    ];

    if (hasExtraHours) {
      data.push(extraHours1);
      data.push(extraHours2);
    }

    // ==========ADD EXTRA HOURS IF THERE'S SOME ==============

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

  if (isLoadingRoles || isLoadingStateRoles || isLoadingUtilities)
    return <Spinner />;

  return (
    <Button variation="secondary" onClick={generatePDF}>
      Generar horario del maestro
    </Button>
  );
}

export default ScheduleTeacherPDF;
