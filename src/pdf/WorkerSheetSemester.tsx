import jsPDF from "jspdf";
import "jspdf-autotable";
import Button from "../ui/Button";
import { useRoles } from "../features/roles/useRoles";

// Extend jsPDF type to include autoTable
declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

function WorkerSheetSemester({
  workers,
  semester,
  scheduleAssignments = [],
  scheduleTeachers = [],
}: {
  workers: any[];
  semester?: any;
  scheduleAssignments?: any[];
  scheduleTeachers?: any[];
}) {
  const activeWorkers = workers.filter((worker) => {
    return worker.status === 1;
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
      willDrawPage: function (data: any) {
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
          startY: 15,
        });

        doc.autoTable({
          styles: {
            halign: "center",
            font: "Montserrat-Bold",
            fontStyle: "bold",
            fontSize: 10,
          },
          body: [["ESCUELA NORMAL URBANA DE BALANCÁN"]],
          theme: "plain",
          startY: 25,
        });

        doc.autoTable({
          styles: {
            halign: "center",
            font: "Montserrat-Regular",
            fontStyle: "normal",
            fontSize: 9,
          },
          body: [["CLAVE: 27DNL0004D"]],
          theme: "plain",
          startY: 35,
        });

        doc.autoTable({
          styles: {
            halign: "center",
            font: "Montserrat-Bold",
            fontStyle: "bold",
            fontSize: 10,
          },
          body: [["PLANTILLA DE PERSONAL"]],
          theme: "plain",
          startY: 45,
        });

        doc.autoTable({
          styles: {
            halign: "center",
            font: "Montserrat-Regular",
            fontStyle: "normal",
            fontSize: 9,
          },
          body: [[`SEMESTRE: ${semester?.name.toUpperCase() || ""}`]],
          theme: "plain",
          startY: 55,
        });
      },
    });

    const columns = [
      "No.",
      "NOMBRE",
      "RFC",
      "CLAVE DE COBRO",
      "FUNCIÓN",
      "HORAS",
      "OBSERVACIONES",
    ];
    const data: any[] = [];

    let count = 1;

    activeWorkers.forEach((worker) => {
      const workerAssignments = scheduleAssignments.filter(
        (assignment) => assignment.worker_id === worker.id
      );

      const workerTeachers = scheduleTeachers.filter(
        (teacher) => teacher.worker_id === worker.id
      );

      let totalHours = 0;

      workerAssignments.forEach((assignment) => {
        totalHours += assignment.hours;
      });

      workerTeachers.forEach((teacher) => {
        const diff =
          new Date(`2000-01-01T${teacher.end_time}`).getTime() -
          new Date(`2000-01-01T${teacher.start_time}`).getTime();
        totalHours += diff / (1000 * 60 * 60);
      });

      const workerRoles = roles?.filter(
        (role: any) => role.id === worker.role_id
      );
      const roleName = workerRoles?.[0]?.name || "";

      data.push([
        count++,
        worker.name,
        worker.rfc,
        worker.curp, // Assuming clave de cobro might be curp or another field, using curp as placeholder if key not found
        roleName,
        totalHours > 0 ? totalHours : "",
        "",
      ]);
    });

    doc.autoTable({
      head: [columns],
      body: data,
      startY: 70,
      styles: {
        fontSize: 7,
        font: "Montserrat-Regular",
      },
      headStyles: {
        fillColor: [255, 255, 255],
        textColor: [0, 0, 0],
        font: "Montserrat-Bold",
        fontStyle: "bold",
        lineWidth: 0.1,
        lineColor: [0, 0, 0],
      },
      bodyStyles: {
        lineWidth: 0.1,
        lineColor: [0, 0, 0],
      },
    });

    doc.save("plantilla_personal.pdf");
  };

  if (isLoadingRoles) return null;

  return (
    <Button onClick={generatePDF} variation="secondary" size="small">
      Descargar PDF
    </Button>
  );
}

export default WorkerSheetSemester;
