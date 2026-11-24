import ts from "typescript";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname, normalize } from "node:path";

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

const paths = walk("src").filter((p) => /\.(ts|tsx)$/.test(p) && !p.endsWith(".d.ts") && p !== "src/types/supabase.ts").sort();
const known = new Set(paths);
const edges = new Map<string, string[]>();
const rows = paths.map((path) => {
  const source = readFileSync(path, "utf8");
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  let any = 0, assertions = 0, nonNull = 0;
  const imports = new Set<string>();
  function visit(node: ts.Node) {
    if (node.kind === ts.SyntaxKind.AnyKeyword) any++;
    if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) assertions++;
    if (ts.isNonNullExpression(node)) nonNull++;
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const spec = node.moduleSpecifier.text;
      if (spec.startsWith(".")) {
        const base = normalize(join(dirname(path), spec));
        const resolved = [base, base + ".ts", base + ".tsx", join(base, "index.ts"), join(base, "index.tsx")].find((p) => known.has(p) && existsSync(p));
        if (resolved) imports.add(resolved);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  edges.set(path, [...imports]);
  return { path, lines: source.split(/\r?\n/).length, any, assertions, nonNull, suppressions: (source.match(/@ts-(?:ignore|expect-error|nocheck)\b/g) ?? []).length, imports: imports.size, test: /\.test\.tsx?$/.test(path) };
});

let index = 0;
const indices = new Map<string, number>(), low = new Map<string, number>();
const stack: string[] = [], active = new Set<string>(), cycles: string[][] = [];
function connect(path: string) {
  indices.set(path, index); low.set(path, index++);
  stack.push(path); active.add(path);
  for (const next of edges.get(path) ?? []) {
    if (!indices.has(next)) { connect(next); low.set(path, Math.min(low.get(path)!, low.get(next)!)); }
    else if (active.has(next)) low.set(path, Math.min(low.get(path)!, indices.get(next)!));
  }
  if (low.get(path) === indices.get(path)) {
    const group: string[] = [];
    let next: string;
    do { next = stack.pop()!; active.delete(next); group.push(next); } while (next !== path);
    if (group.length > 1 || edges.get(path)?.includes(path)) cycles.push(group.sort());
  }
}
for (const path of paths) if (!indices.has(path)) connect(path);
const app = rows.filter((r) => !r.test), tests = rows.filter((r) => r.test);
const totals = (items: typeof rows) => ({
  files: items.length,
  lines: items.reduce((n, r) => n + r.lines, 0),
  explicitAny: items.reduce((n, r) => n + r.any, 0),
  assertions: items.reduce((n, r) => n + r.assertions, 0),
  nonNull: items.reduce((n, r) => n + r.nonNull, 0),
  suppressions: items.reduce((n, r) => n + r.suppressions, 0),
});
console.log(JSON.stringify({
  application: totals(app), tests: totals(tests),
  largest: [...app].sort((a, b) => b.lines - a.lines).slice(0, 20),
  typeReview: [...app].sort((a, b) => b.any - a.any || b.assertions - a.assertions).slice(0, 20),
  cycles,
}, null, 2));
