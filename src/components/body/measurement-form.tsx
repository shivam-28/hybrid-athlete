"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/field";
import { lengthUnit } from "@/lib/body/format";
import type { UnitSystem } from "@/lib/units";
import { addMeasurementAction } from "@/server/body-actions";

const FIELDS = [
  ["waist", "Waist (at navel)"],
  ["hips", "Hips"],
  ["chest", "Chest"],
  ["arm", "Upper arm"],
  ["thigh", "Thigh"],
] as const;

export function MeasurementForm({ units, today }: { units: UnitSystem; today: string }) {
  const [state, formAction, pending] = useActionState(addMeasurementAction, {});
  const unit = lengthUnit(units);
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="unit" value={unit} />
      <Field id="m-date" label="Date">
        <Input id="m-date" name="date" type="date" defaultValue={today} max={today} className="h-11" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        {FIELDS.map(([name, label]) => (
          <Field key={name} id={`m-${name}`} label={`${label} (${unit})`} errors={state.fieldErrors?.[name]}>
            <Input id={`m-${name}`} name={name} type="number" inputMode="decimal" step="0.1" className="h-11" />
          </Field>
        ))}
      </div>
      <p className="text-muted-foreground text-xs">Fill in any you measured. Measure relaxed, same time of day, tape level.</p>
      {state.ok && <p role="status" className="text-sm text-green-600">{state.message}</p>}
      <Button type="submit" className="h-11 w-full" disabled={pending}>Save measurements</Button>
    </form>
  );
}
