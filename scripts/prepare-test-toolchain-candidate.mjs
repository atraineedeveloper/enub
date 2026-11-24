import fs from "node:fs";
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
// Keep ESLint on major 9 and retain the existing lint rules.
pkg.devDependencies.eslint = "^9.39.0";
pkg.devDependencies["@eslint/js"] = "^9.39.0";
pkg.devDependencies["happy-dom"] = "^21.0.4";
pkg.devDependencies["@happy-dom/global-registrator"] = "^21.0.4";
// Preserve distinct major versions of transitive packages.
pkg.overrides = {
  ...pkg.overrides,
  "@eslint/eslintrc": { minimatch: "^3.1.4", ajv: "^6.14.0", "js-yaml": "^4.3.0" },
  "eslint-plugin-react": { minimatch: "^3.1.4" },
  "filelist": { minimatch: "^5.1.8" },
  "glob": { minimatch: "^10.2.3" },
  "@typescript-eslint/typescript-estree": { minimatch: "^10.2.3" },
  "minimatch@3": { "brace-expansion": "^1.1.18" },
  "minimatch@5": { "brace-expansion": "^2.1.4" },
  "minimatch@10": { "brace-expansion": "^5.0.9" },
  "workbox-build": { ...pkg.overrides["workbox-build"], ajv: "^8.18.0" },
};
fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");
