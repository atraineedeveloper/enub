import type { jsPDF } from "jspdf";
import { autoTable as renderTable } from "jspdf-autotable";
import type { UserOptions, Styles, CellHookData } from "jspdf-autotable";

const fontStyles: Record<string, Styles["fontStyle"]> = {
  "Montserrat-Regular": "normal",
  "Montserrat-Bold": "bold",
  "Montserrat-Italic": "italic",
  "Montserrat-BoldItalic": "bolditalic",
};

/** Each existing Montserrat alias registers exactly one style in jsPDF.
 * AutoTable 5 otherwise requests normal/bold from the theme and jsPDF 4
 * falls back to Times when that combination does not exist.
 */
export function normalizeMontserratStyle(styles: Partial<Styles>): void {
  const style = styles.font && fontStyles[styles.font];
  if (style) styles.fontStyle = style;
}

export function autoTable(doc: jsPDF, options: UserOptions): void {
  renderTable(doc, {
    ...options,
    didParseCell(data: CellHookData) {
      options.didParseCell?.(data);
      normalizeMontserratStyle(data.cell.styles);
    },
  });
}
