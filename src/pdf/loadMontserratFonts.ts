// Load independent font registrations concurrently, before constructing jsPDF.
export async function loadMontserratFonts(): Promise<void> {
  await Promise.all([
    import("../styles/Montserrat-Regular-normal.js"),
    import("../styles/Montserrat-Italic-italic.js"),
    import("../styles/Montserrat-Bold-bold.js"),
    import("../styles/Montserrat-BoldItalic-bolditalic.js"),
  ]);
}
