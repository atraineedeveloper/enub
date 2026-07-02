import jsPDF from "jspdf";
import "jspdf-autotable";

function formatDate(value) {
  if (!value) return "";

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getSemesterLabel(semester) {
  if (!semester) return "No seleccionado";
  return [semester.semester, semester.school_year].filter(Boolean).join(" - ");
}

function sanitizeFileName(value = "") {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function buildReportRows(categories = []) {
  return categories.flatMap((category) =>
    (category.document_types ?? []).flatMap((documentType) => {
      const documents = documentType.documents ?? [];

      if (!documents.length) {
        return [
          [
            category.name,
            documentType.name,
            "Pendiente",
            "Sin archivo",
            "",
          ],
        ];
      }

      return documents.map((document) => [
        category.name,
        documentType.name,
        "Cargado",
        document.file_name,
        formatDate(document.created_at),
      ]);
    })
  );
}

export function generateWorkerDocumentReportPdf(reportData) {
  if (!reportData?.worker) {
    throw new Error("Los datos del reporte no están disponibles");
  }

  const { worker, semester, categories } = reportData;
  const doc = new jsPDF("landscape", "px", "letter");
  const pageWidth = doc.internal.pageSize.getWidth();
  const generatedAt = formatDate(new Date().toISOString());
  const semesterLabel = getSemesterLabel(semester);
  const workerName = worker.name ?? "Trabajador";

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Reporte de expediente documental", pageWidth / 2, 34, {
    align: "center",
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Trabajador: ${workerName}`, 32, 62);
  doc.text(`Tipo: ${worker.type_worker ?? "No especificado"}`, 32, 78);
  doc.text(`RFC: ${worker.RFC ?? "No especificado"}`, 32, 94);
  doc.text(`Semestre: ${semesterLabel}`, 340, 62);
  doc.text(`Generado: ${generatedAt}`, 340, 78);

  doc.autoTable({
    startY: 116,
    head: [
      [
        "Categoría",
        "Tipo de documento",
        "Estado",
        "Archivo",
        "Fecha de carga",
      ],
    ],
    body: buildReportRows(categories),
    margin: { left: 32, right: 32, bottom: 32 },
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 4,
      overflow: "linebreak",
      valign: "top",
    },
    headStyles: {
      fillColor: [54, 83, 20],
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [245, 247, 242],
    },
    columnStyles: {
      0: { cellWidth: 110 },
      1: { cellWidth: 150 },
      2: { cellWidth: 70 },
      3: { cellWidth: 220 },
      4: { cellWidth: 100 },
    },
  });

  const safeWorkerName = sanitizeFileName(workerName) || "trabajador";
  const fileName = `reporte-documentos-${safeWorkerName}.pdf`;
  const blobUrl = doc.output("bloburl");
  const previewWindow = window.open(blobUrl, "_blank");

  if (!previewWindow) {
    doc.save(fileName);
  }
}
