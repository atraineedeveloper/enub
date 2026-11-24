import { describe, expect, test } from "bun:test";
import { jsPDF } from "jspdf";
import { autoTable, normalizeMontserratStyle } from "./montserratAutoTable";
import type { Styles } from "jspdf-autotable";

describe("Montserrat PDF styles", () => {
  test("normalizes each legacy alias to its registered weight", () => {
    for (const [font, fontStyle] of Object.entries({
      "Montserrat-Regular": "normal",
      "Montserrat-Bold": "bold",
      "Montserrat-Italic": "italic",
      "Montserrat-BoldItalic": "bolditalic",
    })) {
      const styles: Partial<Styles> = { font, fontStyle: "normal" };
      normalizeMontserratStyle(styles);
      expect(styles.fontStyle).toBe(fontStyle);
    }
  });
  test("preserves standard fonts", () => {
    const styles: Partial<Styles> = { font: "helvetica", fontStyle: "bold" };
    normalizeMontserratStyle(styles);
    expect(styles.fontStyle).toBe("bold");
  });
  test("renders actual Montserrat bold and regular cells without falling back to Times", async () => {
    await import("../styles/Montserrat-Regular-normal.js");
    await import("../styles/Montserrat-Bold-bold.js");
    const doc = new jsPDF();
    const seen: string[] = [];
    autoTable(doc, {
      theme: "plain",
      styles: { font: "Montserrat-Bold" },
      body: [["ESCUELA NORMAL URBANA", { content: "MATUTINO", styles: { font: "Montserrat-Regular" } }]],
      willDrawCell() {
        seen.push(doc.getFont().fontName + ":" + doc.getFont().fontStyle);
      },
    });
    expect(seen).toEqual(["Montserrat-Bold:bold", "Montserrat-Regular:normal"]);
    expect(doc.output("arraybuffer").byteLength).toBeGreaterThan(0);
  });
});
