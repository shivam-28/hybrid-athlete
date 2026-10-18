import { describe, expect, it } from "vitest";
import { adminClient } from "../../../tests/supabase-test-helpers";
import { USER_TABLES } from "./registry";

describe("account registry", () => {
  it("registers every public table that has a user_id column", async () => {
    const { data, error } = await adminClient().rpc("user_owned_tables");
    expect(error).toBeNull();
    const registered = USER_TABLES.map((t) => t.table);
    expect([...(data ?? [])].sort()).toEqual([...registered].sort());
  });
});
