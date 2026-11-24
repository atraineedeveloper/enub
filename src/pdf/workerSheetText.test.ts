import { describe, expect, test } from "bun:test";
import { transformDate, getFileExtension, normalizeMultilineText, buildFunctionPerformedText } from "./workerSheetText";

describe("worker sheet text", () => {
  test("preserves existing date and extension formatting", () => {
    expect(transformDate("2026-11-23")).toBe("23-11-26");
    expect(getFileExtension("foto.JPG")).toBe("JPG");
    expect(getFileExtension(null)).toBeUndefined();
  });
  test("normalizes multiline text and deduplicates functions without changing order", () => {
    expect(normalizeMultilineText("  Uno\n  Dos  ")).toBe("Uno\nDos");
    expect(buildFunctionPerformedText("Docencia", [{ name: "docencia", quantity: 2 }, { name: " Tutoría ", quantity: 1 }])).toBe("Docencia\n\nTutoría");
    expect(buildFunctionPerformedText(null, [])).toBe("");
  });
});
