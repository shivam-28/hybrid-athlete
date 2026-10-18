/**
 * Seeds the shared exercise library from free-exercise-db (Unlicense / public domain),
 * pinned to one commit so every instance gets identical data. Idempotent: upserts on
 * source id and never touches custom exercises or user data.
 *
 *   pnpm seed:exercises                      # uses .env.local
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm seed:exercises   # hosted project
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { toSeedRow, type SourceExercise } from "../src/lib/exercises/seed-transform";

export const FREE_EXERCISE_DB_SHA = "f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5"; // keep in sync with src/lib/exercises/images.ts
export const FREE_EXERCISE_DB_URL = `https://raw.githubusercontent.com/yuhonas/free-exercise-db/${FREE_EXERCISE_DB_SHA}/dist/exercises.json`;

const BATCH = 200;

export async function seedExercises(admin: SupabaseClient, sources: SourceExercise[]): Promise<number> {
  const rows = sources.map(toSeedRow);
  let total = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const { data, error } = await admin.rpc("seed_exercises", { p_exercises: rows.slice(i, i + BATCH) });
    if (error) throw new Error(`Seeding failed: ${error.message}`);
    total += data as number;
  }
  return total;
}

async function main() {
  config({ path: ".env.local", quiet: true });
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY");

  const res = await fetch(FREE_EXERCISE_DB_URL);
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
  const sources = (await res.json()) as SourceExercise[];
  const admin = createClient(url, key, { auth: { persistSession: false } });
  const count = await seedExercises(admin, sources);
  console.log(`Seeded ${count} exercises from free-exercise-db@${FREE_EXERCISE_DB_SHA.slice(0, 7)}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
