import "server-only";
import type { Tables } from "@/lib/database.types";
import { deriveComposition } from "@/lib/body/composition";
import { compositionInputSchema, fieldErrorsOf } from "@/lib/body/schemas";
import { startOfLocalDay } from "@/lib/time";
import type { Profile } from "@/server/auth";
import { BodyError, requireRow } from "./errors";
import { ownsPath, removeFile } from "./uploads";
import type { Db } from "./weights";

export type CompositionTestRow = Tables<"body_composition_tests">;
type SaveOptions = { documentPath?: string | null; source?: "manual" | "extracted" };

function toRow(profile: Profile, input: unknown) {
  const parsed = compositionInputSchema.safeParse(input);
  if (!parsed.success) throw new BodyError("invalid", "Check the highlighted fields.", fieldErrorsOf(parsed.error));
  const { test_date, ...values } = parsed.data;
  const { values: full, derived } = deriveComposition(values);
  return {
    ...full,
    derived_fields: derived,
    local_date: test_date,
    occurred_at: startOfLocalDay(test_date, profile.timezone).toISOString(),
  };
}

/** Saves a confirmed test (manual entry or a confirmed extraction draft). */
export async function saveTest(db: Db, profile: Profile, input: unknown, options: SaveOptions = {}): Promise<CompositionTestRow> {
  const row = toRow(profile, input);
  if (options.documentPath && !ownsPath(profile.user_id, options.documentPath)) {
    throw new BodyError("invalid", "That report file doesn't belong to you.");
  }
  const { data, error } = await db
    .from("body_composition_tests")
    .insert({ ...row, document_path: options.documentPath ?? null, source: options.source ?? "manual" })
    .select()
    .single();
  if (error) throw new BodyError("invalid", "The test could not be saved.");
  return data;
}

export async function updateTest(db: Db, profile: Profile, id: string, input: unknown): Promise<CompositionTestRow> {
  const { data } = await db.from("body_composition_tests").update(toRow(profile, input)).eq("id", id).select().maybeSingle();
  return requireRow(data, "Test");
}

/** Deletes a test and its uploaded report, if any. */
export async function deleteTest(db: Db, id: string): Promise<void> {
  const { data } = await db.from("body_composition_tests").delete().eq("id", id).select("document_path").maybeSingle();
  const row = requireRow(data, "Test");
  if (row.document_path) await removeFile(db, "body-comp-docs", row.document_path);
}

export async function listTests(db: Db): Promise<CompositionTestRow[]> {
  const { data, error } = await db.from("body_composition_tests").select("*").order("local_date", { ascending: false }).order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getTest(db: Db, id: string): Promise<CompositionTestRow> {
  const { data } = await db.from("body_composition_tests").select("*").eq("id", id).maybeSingle();
  return requireRow(data, "Test");
}
