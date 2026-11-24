import fs from "node:fs";
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
pkg.dependencies["react-router-dom"] = "7.18.0";
// Retain the Supabase SDK version already verified by the application.
// Update the vulnerable transitive WebSocket within its existing major range.
pkg.dependencies["@supabase/supabase-js"] = "2.52.0";
pkg.overrides = { ...pkg.overrides, ws: "8.21.1" };
fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");
const path = "src/App.tsx";
const original = fs.readFileSync(path, "utf8");
const previous = `<BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >`;
if (!original.includes(previous)) throw new Error("Unexpected router configuration");
fs.writeFileSync(path, original.replace(previous, "<BrowserRouter>"));
