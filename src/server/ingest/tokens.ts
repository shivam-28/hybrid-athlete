import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/server/supabase-admin";

// ingest_tokens has RLS with no policies: only this module (service role) reads or writes it,
// always scoped to a user_id from requireUser() or from a verified token.

const TOKEN_SHAPE = /^ha_[A-Za-z0-9_-]{43}$/;
const PREFIX_LENGTH = 8;

export type IngestCounts = { inserted: number; updated: number; unchanged: number };
export type IngestTokenStatus = { prefix: string; last4: string; createdAt: string };
export type LastSync = { at: string; counts: IngestCounts } | null;

/** Keyed with the instance secret, so a database dump alone can't be used to test candidate tokens. */
function tokenHash(value: string): string {
  const secret = process.env.APP_ENCRYPTION_KEY;
  if (!secret) throw new Error("APP_ENCRYPTION_KEY is not set");
  return createHmac("sha256", secret).update(value).digest("hex");
}

const sameHash = (storedHex: string, expected: Buffer) => {
  const stored = Buffer.from(storedHex, "hex");
  return stored.length === expected.length && timingSafeEqual(stored, expected);
};

/** Creates a new token (revoking any active one) and returns it. This is the only time the full token exists. */
export async function generateIngestToken(userId: string): Promise<string> {
  const token = `ha_${randomBytes(32).toString("base64url")}`;
  const { error } = await createAdminClient().rpc("rotate_ingest_token", {
    p_user_id: userId,
    p_token_hash: tokenHash(token),
    p_prefix: token.slice(0, PREFIX_LENGTH),
    p_last4: token.slice(-4),
  });
  if (error) throw new Error("Failed to create ingest token");
  return token;
}

export async function revokeIngestToken(userId: string): Promise<void> {
  const { error } = await createAdminClient()
    .from("ingest_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("revoked_at", null);
  if (error) throw new Error("Failed to revoke ingest token");
}

export async function getIngestTokenStatus(userId: string): Promise<IngestTokenStatus | null> {
  const { data } = await createAdminClient()
    .from("ingest_tokens")
    .select("prefix, last4, created_at")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .maybeSingle();
  return data ? { prefix: data.prefix, last4: data.last4, createdAt: data.created_at } : null;
}

/** Most recent successful sync across the user's tokens, so rotating doesn't hide sync history. */
export async function getLastSync(userId: string): Promise<LastSync> {
  const { data } = await createAdminClient()
    .from("ingest_tokens")
    .select("last_used_at, last_result")
    .eq("user_id", userId)
    .not("last_used_at", "is", null)
    .order("last_used_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.last_used_at ? { at: data.last_used_at, counts: data.last_result as IngestCounts } : null;
}

export async function verifyIngestToken(token: string): Promise<{ tokenId: string; userId: string } | null> {
  if (!TOKEN_SHAPE.test(token)) return null;
  const { data } = await createAdminClient()
    .from("ingest_tokens")
    .select("id, user_id, token_hash")
    .eq("prefix", token.slice(0, PREFIX_LENGTH))
    .is("revoked_at", null);
  const expected = Buffer.from(tokenHash(token), "hex");
  const match = (data ?? []).find((row) => sameHash(row.token_hash, expected));
  return match ? { tokenId: match.id, userId: match.user_id } : null;
}

export async function recordIngestSuccess(tokenId: string, counts: IngestCounts): Promise<void> {
  await createAdminClient()
    .from("ingest_tokens")
    .update({ last_used_at: new Date().toISOString(), last_result: counts })
    .eq("id", tokenId);
}

/** Counts this request in the token's hourly window and returns the running total. */
export async function bumpIngestRate(tokenId: string): Promise<number> {
  const { data, error } = await createAdminClient().rpc("bump_ingest_rate", { p_token_id: tokenId });
  if (error) throw new Error("Failed to check ingest rate");
  return data;
}
