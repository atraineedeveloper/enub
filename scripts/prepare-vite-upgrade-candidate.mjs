import fs from "node:fs";
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
// Vite 6 keeps compatibility with the current React and PWA plugins.
// Resolve current compatible releases within the audited major ranges.
pkg.devDependencies.vite = "^6.4.4";
pkg.devDependencies["@vitejs/plugin-react"] = "^4.7.0";
pkg.overrides = {
  ...pkg.overrides,
  postcss: "^8.5.23",
  "source-map-js": "^1.2.2",
  nanoid: "^3.3.18",
};
// Keep Workbox's Rollup 2 and Vite's Rollup 4 separate.
// Refresh each through its parent-specific override, not a global major replacement.
pkg.overrides["vite"] = { rollup: "^4.59.0", esbuild: "^0.25.0" };
pkg.overrides["workbox-build"] = { rollup: "^2.80.0" };
fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");
