// Keep the existing registration order and lazy loading before jsPDF construction.
export async function loadMontserratFonts(): Promise<void> {
  await import("../styles/Montserrat-Regular-normal.js");
  await import("../styles/Montserrat-Italic-italic.js");
  await import("../styles/Montserrat-Bold-bold.js");
  await import("../styles/Montserrat-BoldItalic-bolditalic.js");
}
