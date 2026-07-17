// Extracted as a plain, pure constant (not JSX) so its order/content can be
// unit-tested without rendering. WorkerNav.tsx maps this to icons.
export interface WorkerNavItem {
  to: string;
  label: string;
}

export const WORKER_NAV_ITEMS: WorkerNavItem[] = [
  { to: "/my-documents", label: "Mis documentos" },
  { to: "/my-schedule", label: "Mi horario" },
  { to: "/my-profile", label: "Mi información" },
];
