import { describe, expect, test } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { clearSessionCache } from "./clearSessionCache";

describe("session cache cleanup", () => {
  test("removes query and mutation records after successful logout", async () => {
    const client = new QueryClient();
    client.setQueryData(["workers"], [{ id: 1, name: "Synthetic worker" }]);
    const mutation = client.getMutationCache().build(client, {
      mutationFn: async (value: string) => value,
    });
    await mutation.execute("synthetic payload");
    expect(client.getMutationCache().getAll()).toHaveLength(1);
    await clearSessionCache(client);
    expect(client.getQueryCache().getAll()).toHaveLength(0);
    expect(client.getMutationCache().getAll()).toHaveLength(0);
  });

  test("a late query result cannot repopulate the cleared cache", async () => {
    const client = new QueryClient();
    let resolve!: (value: string) => void;
    const pending = client.fetchQuery({
      queryKey: ["private"],
      queryFn: () => new Promise<string>((done) => { resolve = done; }),
    }).catch(() => undefined);
    await clearSessionCache(client);
    resolve("synthetic private result");
    await pending;
    expect(client.getQueryData(["private"])).toBeUndefined();
  });
});
