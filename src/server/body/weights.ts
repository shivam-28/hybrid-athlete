import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/database.types";
import { fieldErrorsOf, measurementInputSchema, weightInputSchema } from "@/lib/body/schemas";
import { localDate, startOfLocalDay } from "@/lib/time";
import type { Profile } from "@/server/auth";
import { BodyError, requireRow } from "./errors";

export type Db = SupabaseClient<Database>;
export type WeightRow = Tables<"body_weights">;
export type MeasurementRow = Tables<"body_measurements">;
export type DailyBodyWeight = { date: string; weightKg: number; source: "manual" | "apple_health" };

function parseWeight(input: unknown) {
  const parsed = weightInputSchema.safeParse(input);
  if (!parsed.success) throw new BodyError("invalid", "Check the weight.", fieldErrorsOf(parsed.error));
  return parsed.data;
}

export async function addWeight(db: Db, profile: Profile, input: unknown, now = new Date()): Promise<WeightRow> {
  const { weightKg, occurredAt } = parseWeight(input);
  const at = occurredAt ? new Date(occurredAt) : now;
  const { data, error } = await db
    .from("body_weights")
    .insert({ weight_kg: weightKg, occurred_at: at.toISOString(), local_date: localDate(at, profile.timezone) })
    .select()
    .single();
  if (error) throw new BodyError("invalid", "The weight could not be saved.");
  return data;
}

/** Edits the value (and optionally the time) of the caller's own manual entry. */
export async function updateWeight(db: Db, profile: Profile, id: string, input: unknown): Promise<WeightRow> {
  const { weightKg, occurredAt } = parseWeight(input);
  const patch = occurredAt
    ? { weight_kg: weightKg, occurred_at: occurredAt, local_date: localDate(new Date(occurredAt), profile.timezone) }
    : { weight_kg: weightKg };
  const { data } = await db.from("body_weights").update(patch).eq("id", id).select().maybeSingle();
  return requireRow(data, "Weight entry");
}

export async function deleteWeight(db: Db, id: string): Promise<void> {
  const { data } = await db.from("body_weights").delete().eq("id", id).select("id").maybeSingle();
  requireRow(data, "Weight entry");
}

/** Canonical daily weights (manual beats Apple Health), oldest first. */
export async function listDailyWeights(db: Db, since?: string): Promise<DailyBodyWeight[]> {
  let query = db.from("daily_body_weight").select("local_date, weight_kg, source").order("local_date");
  if (since) query = query.gte("local_date", since);
  const { data, error } = await query;
  if (error) throw error;
  return data.map((r) => ({ date: r.local_date!, weightKg: Number(r.weight_kg), source: r.source as DailyBodyWeight["source"] }));
}

export async function listWeightEntries(db: Db, limit = 30): Promise<WeightRow[]> {
  const { data, error } = await db.from("body_weights").select("*").order("occurred_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return data;
}

export async function addMeasurement(db: Db, profile: Profile, input: unknown, now = new Date()): Promise<MeasurementRow> {
  const parsed = measurementInputSchema.safeParse(input);
  if (!parsed.success) throw new BodyError("invalid", "Check the measurements.", fieldErrorsOf(parsed.error));
  const date = parsed.data.date ?? localDate(now, profile.timezone);
  const { data, error } = await db
    .from("body_measurements")
    .insert({ ...parsed.data.values, local_date: date, occurred_at: startOfLocalDay(date, profile.timezone).toISOString() })
    .select()
    .single();
  if (error) throw new BodyError("invalid", "The measurement could not be saved.");
  return data;
}

export async function listMeasurements(db: Db, since?: string): Promise<MeasurementRow[]> {
  let query = db.from("body_measurements").select("*").order("local_date");
  if (since) query = query.gte("local_date", since);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}
