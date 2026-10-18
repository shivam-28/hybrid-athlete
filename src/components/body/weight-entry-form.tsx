"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/field";
import { weightUnit } from "@/lib/body/format";
import type { UnitSystem } from "@/lib/units";
import { addWeightAction } from "@/server/body-actions";

export function WeightEntryForm({ units }: { units: UnitSystem }) {
  const [state, formAction, pending] = useActionState(addWeightAction, {});
  const unit = weightUnit(units);
  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="unit" value={unit} />
      <Field id="weight" label={`Weight (${unit})`} errors={state.fieldErrors?.weight}>
        <div className="flex gap-2">
          <Input id="weight" name="weight" type="number" inputMode="decimal" step="0.1" required className="h-11" />
          <Button type="submit" className="h-11" disabled={pending}>
            Log
          </Button>
        </div>
      </Field>
      {state.ok && <p role="status" className="text-sm text-green-600">{state.message}</p>}
      {!state.ok && state.message && !state.fieldErrors && <p role="alert" className="text-destructive text-sm">{state.message}</p>}
    </form>
  );
}
