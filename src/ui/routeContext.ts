import { matchPath } from "react-router-dom";

// Ordered most-specific-first: matchPath does not rank patterns by
// specificity itself, so /workers/:id/documents must be listed (and
// therefore tried) before /workers/:id, which must precede /workers, for
// the more specific route to win.
const ROUTE_CONTEXT_PATTERNS: { pattern: string; label: string }[] = [
  { pattern: "/workers/:id/documents", label: "Documentos del trabajador" },
  { pattern: "/workers/:id", label: "Detalle del trabajador" },
  { pattern: "/workers", label: "Trabajadores" },
  { pattern: "/semesters/:id", label: "Horario del semestre" },
  { pattern: "/semesters", label: "Semestres" },
  { pattern: "/dashboard", label: "Inicio" },
  { pattern: "/degrees", label: "Licenciaturas" },
  { pattern: "/subjects", label: "Materias" },
  { pattern: "/groups", label: "Grupos" },
  { pattern: "/study-programs", label: "Programas de estudio" },
  { pattern: "/state-roles", label: "Roles estatales" },
  { pattern: "/roles", label: "Roles" },
  { pattern: "/others", label: "Otros" },
  { pattern: "/my-documents", label: "Mis documentos" },
  { pattern: "/my-schedule", label: "Mi horario" },
  { pattern: "/my-profile", label: "Mi información" },
  { pattern: "/pending-access", label: "Acceso pendiente" },
];

export const ROUTE_CONTEXT_FALLBACK_LABEL = "ENU";

// Never displays a raw URL segment: an unmatched authenticated route
// resolves to the fixed fallback label above.
export function resolveRouteContextLabel(pathname: string): string {
  for (const { pattern, label } of ROUTE_CONTEXT_PATTERNS) {
    if (matchPath({ path: pattern, end: true }, pathname)) return label;
  }
  return ROUTE_CONTEXT_FALLBACK_LABEL;
}
