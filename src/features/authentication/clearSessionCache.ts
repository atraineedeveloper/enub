import type { QueryClient } from "@tanstack/react-query";

// Cancel outstanding reads before removing both query and mutation caches.
// Do not clear unrelated browser storage (e.g. theme preferences).
export async function clearSessionCache(client: QueryClient): Promise<void> {
  await client.cancelQueries();
  client.clear();
}
