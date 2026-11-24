import fs from "node:fs";

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
pkg.dependencies.jspdf = "4.2.1";
pkg.dependencies["jspdf-autotable"] = "5.0.9";
// Restrict existing transitive dependencies to reviewed patched candidates.
pkg.overrides = { ...pkg.overrides, dompurify: "3.5.0", fflate: "0.8.3" };
fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");
for (const path of [
  "src/pdf/Schedules/ScheduleTeacherPDF.tsx",
  "src/pdf/Schedules/ScheduleGroupPDF.tsx",
  "src/pdf/Schedules/TeacherAssignmentPDF.tsx",
  "src/pdf/WorkerSheetSemester.tsx",
]) {
  const original = fs.readFileSync(path, "utf8");
  if (!original.includes('import "jspdf-autotable";') || !original.includes("doc.autoTable(")) {
    throw new Error("Unexpected PDF implementation: " + path);
  }
  const migrated = original
    .replace('import "jspdf-autotable";', 'import { autoTable } from "jspdf-autotable";')
    .replaceAll("doc.autoTable(", "autoTable(doc, ");
  fs.writeFileSync(path, migrated);
}
