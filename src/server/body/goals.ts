import "server-only";
import type { Tables } from "@/lib/database.types";
import { fieldErrorsOf, goalInputSchema } from "@/lib/body/schemas";
import { localDate } from "@/lib/time";
import type { Profile } from "@/server/auth";
import { BodyError } from "./errors";
import type { Db } from "./weights";

export type GoalRow = Tables<"body_goals">;

/** Saves a new active goal, archiving the previous one in the same transaction. */
export async function setGoal(db: Db, profile: Profile, input: unknown, now = new Date()): Promise<GoalRow> {
  const parsed = goalInputSchema.safeParse(input);
  if (!parsed.success) throw new BodyError("invalid", "Check your goal.", fieldErrorsOf(parsed.error));
  const { goalWeightKg, goalBodyFatPct, targetDate } = parsed.data;
  const today = localDate(now, profile.timezone);
  if (targetDate !== null && targetDate <= today) {
    throw new BodyError("invalid", "Check your goal.", { target_date: ["Pick a target date from tomorrow onwards."] });
  }
  const { data: id, error } = await db.rpc("replace_body_goal", {
    p_goal_weight_kg: goalWeightKg as number,
    p_goal_body_fat_pct: goalBodyFatPct as number,
    p_target_date: targetDate as string,
    p_occurred_at: now.toISOString(),
    p_local_date: today,
  });
  if (error) throw new BodyError("invalid", "The goal could not be saved.");
  const { data } = await db.from("body_goals").select("*").eq("id", id).single();
  return data!;
}

export async function getActiveGoal(db: Db): Promise<GoalRow | null> {
  const { data } = await db.from("body_goals").select("*").eq("status", "active").maybeSingle();
  return data;
}

export async function listGoalHistory(db: Db): Promise<GoalRow[]> {
  const { data } = await db.from("body_goals").select("*").order("created_at", { ascending: false });
  return data ?? [];
}
