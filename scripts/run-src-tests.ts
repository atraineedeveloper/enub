import { readdirSync } from "node:fs";
import { join } from "node:path";

function collectTestFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) return collectTestFiles(path);
    if (/\.test\.tsx?$/.test(entry.name)) return [path];

    return [];
  });
}

const testFiles = collectTestFiles("src").sort();

if (testFiles.length === 0) {
  console.error("No test files were found under src.");
  process.exit(1);
}

const failedFiles: string[] = [];
const testEnvironment = {
  ...process.env,
  VITE_SUPABASE_URL:
    process.env.VITE_SUPABASE_URL ?? "http://127.0.0.1:54321",
  VITE_SUPABASE_ANON_KEY:
    process.env.VITE_SUPABASE_ANON_KEY ?? "local-test-anon-key",
};

for (const testFile of testFiles) {
  console.log(`\n=== ${testFile} ===`);

  const result = Bun.spawnSync({
    cmd: [process.execPath, "test", "--isolate", testFile],
    stdout: "inherit",
    stderr: "inherit",
    env: testEnvironment,
  });

  if (result.exitCode !== 0) failedFiles.push(testFile);
}

if (failedFiles.length > 0) {
  console.error(`\n${failedFiles.length} test file(s) failed:`);
  for (const failedFile of failedFiles) console.error(`- ${failedFile}`);
  process.exit(1);
}

console.log(`\nAll ${testFiles.length} test files passed.`);
