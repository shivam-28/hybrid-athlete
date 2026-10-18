import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

export function adminClient(): SupabaseClient<Database> {
  return createClient<Database>(url(), process.env.SUPABASE_SERVICE_ROLE_KEY!, noSession);
}

export function anonClient(): SupabaseClient<Database> {
  return createClient<Database>(url(), anonKey(), noSession);
}

export const testEmail = (prefix = "user") => `${prefix}-${randomUUID().slice(0, 8)}@test.local`;

export type TestUser = { id: string; email: string; client: SupabaseClient<Database> };

/** Creates a confirmed user and returns a client signed in as them via the OTP token-hash flow the app uses. */
export async function createTestUser(email = testEmail()): Promise<TestUser> {
  const admin = adminClient();
  const created = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (created.error) throw created.error;
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (link.error) throw link.error;
  const client = anonClient();
  const verified = await client.auth.verifyOtp({
    token_hash: link.data.properties.hashed_token,
    type: "email",
  });
  if (verified.error) throw verified.error;
  return { id: created.data.user.id, email, client };
}

export async function deleteTestUser(user: { id: string } | undefined) {
  if (user) await adminClient().auth.admin.deleteUser(user.id);
}

export const sampleProfile = {
  display_name: "Test",
  sex: "male" as const,
  birth_date: "1995-06-01",
  height_cm: 180,
  unit_system: "metric" as const,
  timezone: "Europe/Copenhagen",
  strength_experience: "beginner" as const,
  running_experience: "beginner" as const,
};
