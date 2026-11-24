import fs from "node:fs";
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
pkg.dependencies["react-router-dom"] = "7.18.6";
pkg.overrides = {
  ...pkg.overrides,
  "@babel/core": "^7.29.13",
  "@babel/plugin-transform-modules-systemjs": "^7.29.4",
  "@humanfs/node": "^0.16.8",
  "baseline-browser-mapping": "^2.11.0",
  browserslist: "^4.28.7",
  "fast-uri": "^3.1.9",
  flatted: "^3.4.2",
  lodash: "^4.17.24",
  "picomatch@2": "^2.3.2",
  "picomatch@4": "^4.0.4",
  "serialize-javascript": "^7.1.3",
  "workbox-build": { ...pkg.overrides["workbox-build"], glob: "^14.0.2" },
  glob: { minimatch: "^11.0.1" },
  "@typescript-eslint/typescript-estree": { minimatch: "^11.0.1" },
};
// These cross-major transitive candidates are experimental only.
// No committed dependency or production changes until CI and audit are reviewed.
fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");
