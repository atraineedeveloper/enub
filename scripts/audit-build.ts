import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

interface Chunk {
  file: string;
  imports?: string[];
  dynamicImports?: string[];
  isEntry?: boolean;
}
const manifest: Record<string, Chunk> = JSON.parse(readFileSync("dist/.vite/manifest.json", "utf8"));
function closure(keys: string[]) {
  const seen = new Set<string>();
  function visit(key: string) {
    if (seen.has(key)) return;
    const chunk = manifest[key];
    if (!chunk) throw new Error("Missing manifest chunk: " + key);
    seen.add(key);
    for (const dependency of chunk.imports ?? []) visit(dependency);
  }
  keys.forEach(visit);
  return [...new Set([...seen].map((key) => manifest[key].file))];
}
function sizes(paths: string[]) {
  return paths.reduce((total, path) => {
    const data = readFileSync(join("dist", path));
    return { bytes: total.bytes + data.length, gzipBytes: total.gzipBytes + gzipSync(data).length };
  }, { bytes: 0, gzipBytes: 0 });
}
const entries = Object.keys(manifest).filter((key) => manifest[key].isEntry);
const routes = Object.keys(manifest).filter((key) => /(?:ScheduleDashboard|WorkerDocuments|WorkerDocumentsView|MyDocuments|Login)\.tsx$/.test(key));
if (!entries.length || !routes.some(key => key.endsWith("ScheduleDashboard.tsx")) || !routes.some(key => key.endsWith("WorkerDocuments.tsx"))) throw new Error("Missing required audit routes");
const initial = closure(entries);
const routeReports = routes.map((key) => {
  const files = closure([...entries, key]);
  return { route: key, ...sizes(files), files, pdfEngineEager: files.some((file) => /jspdf|autotable|Montserrat-/i.test(file)) };
});
const assets = readdirSync("dist/assets").map((file) => ({ file, bytes: statSync(join("dist/assets", file)).size })).sort((a,b) => b.bytes-a.bytes);
console.log(JSON.stringify({ initial: { ...sizes(initial), files: initial }, routes: routeReports, largest: assets.slice(0, 15) }, null, 2));
if (initial.some((file) => /jspdf|autotable|Montserrat-/i.test(file)) || routeReports.some((route) => route.pdfEngineEager)) {
  throw new Error("PDF engine or fonts are statically loaded in an audited route");
}
