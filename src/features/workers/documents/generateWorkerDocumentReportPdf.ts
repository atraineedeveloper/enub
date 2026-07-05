import jsPDF from "jspdf";
import "jspdf-autotable";
import type {
  WorkerDocumentReportCategory,
  WorkerDocumentReportData,
} from "./useWorkerDocumentReportData";
import type { Semester } from "../../semesters/useSemesters";

// jspdf-autotable's bundled types only export a standalone `autoTable(doc,
// options)` function -- this version doesn't augment jsPDF's own type with an
// `autoTable` instance method, even though the plugin's side-effect import
// (above) does add it at runtime, and `doc.autoTable(...)` is the call style
// used throughout this codebase's other PDF generators (src/pdf/*.jsx, out of
// scope). Local, type-only cast rather than adding an ambient .d.ts or a
// dependency.
type JsPdfWithAutoTable = jsPDF & {
  autoTable: (options: Record<string, unknown>) => void;
};

function formatDate(value?: string | null) {
  if (!value) return "";

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getSemesterLabel(semester?: Semester | null) {
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

function wrapLongText(value = "", chunkSize = 36) {
  return String(value)
    .split(/(\s+)/)
    .map((part) => {
      if (/^\s+$/.test(part) || part.length <= chunkSize) return part;

      return part.match(new RegExp(`.{1,${chunkSize}}`, "g"))!.join("\n");
    })
    .join("");
}

function buildReportRows(categories: WorkerDocumentReportCategory[] = []) {
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
        wrapLongText(document.file_name),
        formatDate(document.created_at),
      ]);
    })
  );
}

export function generateWorkerDocumentReportPdf(
  reportData: WorkerDocumentReportData
) {
  if (!reportData?.worker) {
    throw new Error("Los datos del reporte no están disponibles");
  }

  const { worker, semester, categories } = reportData;
  const doc = new jsPDF("landscape", "px", "letter") as JsPdfWithAutoTable;
  const pageWidth = doc.internal.pageSize.getWidth();
  const horizontalMargin = 24;
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
    margin: { left: horizontalMargin, right: horizontalMargin, bottom: 24 },
    tableWidth: pageWidth - horizontalMargin * 2,
    styles: {
      font: "helvetica",
      fontSize: 6.5,
      cellPadding: 3,
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
      0: { cellWidth: 92 },
      1: { cellWidth: 148 },
      2: { cellWidth: 58 },
      3: { cellWidth: 335 },
      4: { cellWidth: 82 },
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
