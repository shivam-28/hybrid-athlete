"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { displayWeight, weightUnit } from "@/lib/body/format";
import { formatLocalDateTime } from "@/lib/activities/format";
import type { UnitSystem } from "@/lib/units";
import { deleteWeightAction, updateWeightAction } from "@/server/body-actions";

type Entry = { id: string; weight_kg: number; occurred_at: string };

function EditWeight({ entry, units }: { entry: Entry; units: UnitSystem }) {
  const [state, formAction, pending] = useActionState(updateWeightAction.bind(null, entry.id), {});
  const unit = weightUnit(units);
  return (
    <form action={formAction} className="flex items-start gap-2 pt-2">
      <input type="hidden" name="unit" value={unit} />
      <div className="flex-1">
        <Input
          name="weight"
          type="number"
          inputMode="decimal"
          step="0.1"
          defaultValue={displayWeight(entry.weight_kg, units)}
          aria-label={`New weight (${unit})`}
          className="h-11"
        />
        {state.fieldErrors?.weight?.map((e) => (
          <p key={e} className="text-destructive text-sm">{e}</p>
        ))}
      </div>
      <Button type="submit" variant="secondary" className="h-11" disabled={pending}>Save</Button>
    </form>
  );
}

export function WeightHistory(props: { entries: Entry[]; units: UnitSystem; timezone: string }) {
  if (props.entries.length === 0) return <p className="text-muted-foreground text-sm">No manual weigh-ins yet.</p>;
  const unit = weightUnit(props.units);
  return (
    <ul className="divide-y" aria-label="Manual weigh-ins">
      {props.entries.map((entry) => (
        <li key={entry.id} className="py-2">
          <details>
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3">
              <span>
                <span className="font-medium">{displayWeight(entry.weight_kg, props.units)} {unit}</span>
                <span className="text-muted-foreground ml-2 text-sm">{formatLocalDateTime(entry.occurred_at, props.timezone)}</span>
              </span>
              <span className="text-muted-foreground text-sm">Edit</span>
            </summary>
            <EditWeight entry={entry} units={props.units} />
            <form action={deleteWeightAction.bind(null, entry.id)} className="pt-2">
              <Button type="submit" variant="ghost" size="sm" className="text-destructive">Delete entry</Button>
            </form>
          </details>
        </li>
      ))}
    </ul>
  );
}
