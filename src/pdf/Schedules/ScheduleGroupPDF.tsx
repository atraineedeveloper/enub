import toast from "react-hot-toast";
import { loadPdfImage } from "../loadPdfImage";
import jsPDF from "jspdf";
import { autoTable } from "../montserratAutoTable";
import type { RowInput } from "jspdf-autotable";
import { useContext } from "react";
import Button from "../../ui/Button";
import { useRoles } from "../../features/roles/useRoles";
import { useStateRoles } from "../../features/stateRoles/useStateRoles";
import Spinner from "../../ui/Spinner";
import filterHour from "./filterHour";
import { calculateSemesterGroupForSemester } from "../../helpers/calculateSemesterGroup";
import capitalizeName from "../../helpers/capitalizeFirstLetter";
import { useUtilities } from "../../features/otherData/useUtilities";
import { SemesterContext } from "../../pages/SemesterContext";
import type { ScheduleAssignment } from "../../features/schedules/useScheduleAssignments";
import type { Database } from "../../types/supabase";

type StateRole = Database["public"]["Tables"]["state_roles"]["Row"];

interface ScheduleGroupPDFProps {
  schedules: ScheduleAssignment[];
}

function ScheduleGroupPDF({ schedules }: ScheduleGroupPDFProps) {
  const { isLoading: isLoadingRoles, roles } = useRoles();
  const { isLoading: isLoadingStateRoles, stateRoles } = useStateRoles();
  const { isLoading: isLoadingUtilities, utilities } = useUtilities();
  const semesterData = useContext(SemesterContext);
  const semesterCode = semesterData?.semesterCode ?? null;

  // Deterministic fix: seed data only guarantees 1 row in each table, so
  // roles[1]/stateRoles[1] are undefined. Mirrors WorkerSheetSemester.jsx's
  // `roles ?? []` + optional-chaining pattern for this same data source.
  const availableRoles = roles ?? [];
  const availableStateRoles: StateRole[] =
    (stateRoles as StateRole[] | undefined) ?? [];

  const generatePDF = async () => {
    try {
    await import("../../styles/Montserrat-Regular-normal.js");
    await import("../../styles/Montserrat-Italic-italic.js");
    await import("../../styles/Montserrat-Bold-bold.js");
    await import("../../styles/Montserrat-BoldItalic-bolditalic.js");

    const doc = new jsPDF("p", "px", "letter");

    const infoGroup = [
      [
        "ESCUELA NORMAL URBANA",
        `PERIODO ESCOLAR: ${schedules[0]?.semesters?.school_year ?? "No registrado"}`,
      ],
      [schedules[0]?.groups?.degrees?.name?.toUpperCase() ?? "LICENCIATURA NO REGISTRADA", `PLAN: 2022`],
      [
        `SEMESTRE: ${schedules[0]?.groups?.year_of_admission == null ? "—" : calculateSemesterGroupForSemester(
          schedules[0].groups.year_of_admission,
          semesterCode
        )}°    GRUPO: ${schedules[0]?.groups?.letter ?? "—"}`,
        `TURNO: MATUTINO`,
      ],
    ];

    const columns = ["", "LUNES", "MARTES", "MIÉRCOLES", "JUEVES", "VIERNES"];
    const data: RowInput[] = [
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

    autoTable(doc, {
      styles: {
        valign: "middle",
        font: "Montserrat-Bold",
        fontSize: 9,
      },
      body: infoGroup,
      theme: "plain",
    });

    // Schedule of the group

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
        0: { cellWidth: 50 },
      },
      head: [columns],
      body: data,
      theme: "grid",
    });

    const infoSchool: RowInput[] = [
      ["", "", `Balancán, Tabasco a ${utilities![0].value}`],
      [
        {
          content: availableRoles[1]?.role ?? "",
          styles: { font: "Montserrat-Bold" },
        },
        {
          content: "Vo. Bo",
          rowSpan: 4,
          styles: { halign: "center" },
        },
        {
          content: availableRoles[0]?.role ?? "",
          styles: { font: "Montserrat-Bold" },
        },
      ],
      [
        capitalizeName(availableRoles[1]?.workers?.name ?? ""),
        capitalizeName(availableRoles[0]?.workers?.name ?? ""),
      ],
      [
        {
          content: availableStateRoles[0]?.role ?? "",
          styles: { font: "Montserrat-Bold" },
        },
        {
          content: availableStateRoles[1]?.role ?? "",
          styles: { font: "Montserrat-Bold" },
        },
      ],
      [
        capitalizeName((availableStateRoles[0]?.name_worker ?? "").toUpperCase()),
        capitalizeName((availableStateRoles[1]?.name_worker ?? "").toUpperCase()),
      ],
    ];

    autoTable(doc, {
      styles: {
        halign: "center",
        valign: "middle",
        font: "Montserrat-Regular",
        fontSize: 9,
      },
      body: infoSchool,
      theme: "plain",
    });

    const blobUrl = doc.output("bloburl");
    const previewWindow = window.open(blobUrl, "_blank");
    if (!previewWindow) doc.save("HorarioGrupal.pdf");
    } catch (error) {
      console.error("PDF export failed", error);
      toast.error("No se pudo generar el PDF. Revisa los datos e inténtalo nuevamente.");
    }
  };

  if (isLoadingRoles || isLoadingStateRoles || isLoadingUtilities)
    return <Spinner />;

  return (
    <Button variation="secondary" onClick={generatePDF}>
      Generar horario grupal
    </Button>
  );
}

export default ScheduleGroupPDF;
