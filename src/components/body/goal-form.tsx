"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/field";
import { weightUnit } from "@/lib/body/format";
import type { UnitSystem } from "@/lib/units";
import { setGoalAction } from "@/server/body-actions";

export type GoalDefaults = { goalWeight: string; goalBodyFatPct: string; targetDate: string };

export function GoalForm(props: { units: UnitSystem; defaults: GoalDefaults; tomorrow: string }) {
  const [state, formAction, pending] = useActionState(setGoalAction, {});
  const unit = weightUnit(props.units);
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="unit" value={unit} />
      <div className="grid grid-cols-2 gap-3">
        <Field id="goal_weight" label={`Goal weight (${unit})`} errors={state.fieldErrors?.goal_weight}>
          <Input id="goal_weight" name="goal_weight" type="number" inputMode="decimal" step="0.1" defaultValue={props.defaults.goalWeight} className="h-11" />
        </Field>
        <Field id="goal_body_fat_pct" label="Goal body fat (%)" errors={state.fieldErrors?.goal_body_fat_pct}>
          <Input id="goal_body_fat_pct" name="goal_body_fat_pct" type="number" inputMode="decimal" step="0.1" defaultValue={props.defaults.goalBodyFatPct} className="h-11" />
        </Field>
      </div>
      <Field id="target_date" label="Target date (optional)" errors={state.fieldErrors?.target_date}>
        <Input id="target_date" name="target_date" type="date" min={props.tomorrow} defaultValue={props.defaults.targetDate} className="h-11" />
      </Field>
      {state.ok && <p role="status" className="text-sm text-green-600">{state.message}</p>}
      <Button type="submit" className="h-11 w-full" disabled={pending}>Save goal</Button>
      <p className="text-muted-foreground text-xs">Saving replaces your current goal; earlier goals stay in your history.</p>
    </form>
  );
}

/** One-tap fix for an unsafe target date: resubmits the same goal with the earliest safe date. */
export function UseSafeDateButton(props: { units: UnitSystem; defaults: GoalDefaults; safeDate: string; label: string }) {
  const [, formAction, pending] = useActionState(setGoalAction, {});
  return (
    <form action={formAction}>
      <input type="hidden" name="unit" value={weightUnit(props.units)} />
      <input type="hidden" name="goal_weight" value={props.defaults.goalWeight} />
      <input type="hidden" name="goal_body_fat_pct" value={props.defaults.goalBodyFatPct} />
      <input type="hidden" name="target_date" value={props.safeDate} />
      <Button type="submit" variant="secondary" size="sm" className="mt-2 min-h-11" disabled={pending}>{props.label}</Button>
    </form>
  );
}
