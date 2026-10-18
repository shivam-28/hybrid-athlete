import { afterAll, afterEach, describe, expect, it } from "vitest";
import {
  adminClient,
  anonClient,
  createTestUser,
  deleteTestUser,
  testEmail,
  type TestUser,
} from "../../tests/supabase-test-helpers";

const created: string[] = [];

async function requestSignIn(email: string) {
  const res = await anonClient().auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (!res.error) {
    const { data } = await adminClient().auth.admin.listUsers({ perPage: 1000 });
    const user = data.users.find((u) => u.email === email);
    if (user) created.push(user.id);
  }
  return res;
}

async function setAllowlist(patterns: string[]) {
  const admin = adminClient();
  await admin.from("signup_allowlist").delete().neq("pattern", "");
  if (patterns.length) await admin.from("signup_allowlist").insert(patterns.map((pattern) => ({ pattern })));
}

afterEach(() => setAllowlist([]));
afterAll(async () => {
  await Promise.all(created.map((id) => adminClient().auth.admin.deleteUser(id)));
});

describe("signup allowlist hook", () => {
  it("Given an empty allowlist, When any email requests sign-in, Then it is allowed", async () => {
    const { error } = await requestSignIn(testEmail("open"));
    expect(error).toBeNull();
  });

  it("Given an exact email entry, When that email requests sign-in, Then it is allowed", async () => {
    const email = testEmail("exact");
    await setAllowlist([email, "@elsewhere.example"]);
    const { error } = await requestSignIn(email);
    expect(error).toBeNull();
  });

  it("Given a @domain entry, When an email on that domain requests sign-in, Then it is allowed", async () => {
    await setAllowlist(["@test.local"]);
    const { error } = await requestSignIn(testEmail("Domain").toUpperCase());
    expect(error).toBeNull();
  });

  it("Given entries that do not match, When a new email requests sign-in, Then it is rejected as invite-only", async () => {
    await setAllowlist(["@friends.example"]);
    const { error } = await requestSignIn(testEmail("stranger"));
    expect(error?.message).toMatch(/invite-only/i);
  });

  it("Given an existing user removed from the allowlist, When they sign in again, Then it still works", async () => {
    let existing: TestUser | undefined;
    try {
      existing = await createTestUser();
      await setAllowlist(["@friends.example"]);
      // Supabase throttles OTP emails per address (max_frequency = 1s in config.toml).
      await new Promise((r) => setTimeout(r, 1100));
      const { error } = await anonClient().auth.signInWithOtp({ email: existing.email });
      expect(error).toBeNull();
    } finally {
      await setAllowlist([]);
      await deleteTestUser(existing);
    }
  });
});
