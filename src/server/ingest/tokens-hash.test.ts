import { describe, expect, it, vi } from "vitest";

const rows: { id: string; user_id: string; token_hash: string }[] = [];
vi.mock("@/server/supabase-admin", () => ({
  createAdminClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ is: async () => ({ data: rows }) }) }) }),
  }),
}));

describe("verifyIngestToken", () => {
  it("Given a malformed stored hash, Then it is treated as non-matching instead of throwing", async () => {
    process.env.APP_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString("base64");
    const { verifyIngestToken } = await import("./tokens");
    const token = `ha_${"a".repeat(43)}`;
    rows.push({ id: "t1", user_id: "u1", token_hash: "abc" });
    await expect(verifyIngestToken(token)).resolves.toBeNull();
  });
});
