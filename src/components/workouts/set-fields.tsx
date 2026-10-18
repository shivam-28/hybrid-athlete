"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/native-select";
import { kgToWeightInput, weightInputToKg, type UnitSystem } from "@/lib/units";
import { SET_TYPES } from "@/lib/workouts/set-schema";
import type { SetType, TrackingMode } from "@/lib/workouts/types";

export type SetFieldValues = { weight: string; reps: string; duration: string; distance: string; rpe: string; set_type: SetType };

export const emptySetFields: SetFieldValues = { weight: "", reps: "", duration: "", distance: "", rpe: "", set_type: "working" };

export function setFieldsFrom(
  set: { weight_kg: number | null; reps: number | null; duration_s: number | null; distance_m: number | null; rpe?: number | null; set_type?: SetType },
  units: UnitSystem,
): SetFieldValues {
  const str = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));
  return {
    weight: set.weight_kg === null ? "" : String(kgToWeightInput(set.weight_kg, units)),
    reps: str(set.reps),
    duration: str(set.duration_s),
    distance: str(set.distance_m),
    rpe: str(set.rpe),
    set_type: set.set_type ?? "working",
  };
}

const num = (s: string) => (s.trim() === "" ? null : Number(s));

/** Converts form values (user units) to the API body (kg, seconds, meters). */
export function setBodyFrom(v: SetFieldValues, units: UnitSystem) {
  const weight = num(v.weight);
  return {
    weight_kg: weight === null ? null : weightInputToKg(weight, units),
    reps: num(v.reps),
    duration_s: num(v.duration),
    distance_m: num(v.distance),
    rpe: num(v.rpe),
    set_type: v.set_type,
  };
}

const TYPE_LABELS: Record<SetType, string> = { warmup: "Warm-up", working: "Working", drop: "Drop set", failure: "To failure" };

export function SetFields(props: {
  idPrefix: string;
  mode: TrackingMode;
  units: UnitSystem;
  values: SetFieldValues;
  onChange: (v: SetFieldValues) => void;
  errors?: Record<string, string[] | undefined>;
  compact?: boolean;
}) {
  const { mode, values, onChange, idPrefix } = props;
  const unit = props.units === "metric" ? "kg" : "lb";
  const field = (key: keyof SetFieldValues, label: string, opts: { step?: string; inputMode?: "decimal" | "numeric"; errorKey?: string }) => (
    <div className="space-y-1">
      <Label htmlFor={`${idPrefix}-${key}`} className="text-xs">
        {label}
      </Label>
      <Input
        id={`${idPrefix}-${key}`}
        type="number"
        inputMode={opts.inputMode ?? "decimal"}
        step={opts.step ?? "any"}
        min={0}
        value={values[key]}
        onChange={(e) => onChange({ ...values, [key]: e.target.value })}
        aria-invalid={!!props.errors?.[opts.errorKey ?? ""]}
        className="h-11 text-base"
      />
      {props.errors?.[opts.errorKey ?? ""]?.map((e) => (
        <p key={e} className="text-destructive text-xs">
          {e}
        </p>
      ))}
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {(mode === "weight_reps" || mode === "bodyweight_reps") && (
          <>
            {field("weight", mode === "bodyweight_reps" ? `Added weight (${unit})` : `Weight (${unit})`, { errorKey: "weight_kg" })}
            {field("reps", "Reps", { inputMode: "numeric", step: "1", errorKey: "reps" })}
          </>
        )}
        {mode === "duration" && (
          <>
            {field("duration", "Duration (seconds)", { inputMode: "numeric", step: "1", errorKey: "duration_s" })}
            {field("weight", `Added weight (${unit})`, { errorKey: "weight_kg" })}
          </>
        )}
        {mode === "distance_duration" && (
          <>
            {field("distance", "Distance (m)", { errorKey: "distance_m" })}
            {field("duration", "Duration (seconds)", { inputMode: "numeric", step: "1", errorKey: "duration_s" })}
            {field("weight", `Weight carried (${unit})`, { errorKey: "weight_kg" })}
          </>
        )}
      </div>
      {!props.compact && (
        <div className="grid grid-cols-2 gap-3">
          {field("rpe", "RPE (optional)", { step: "0.5", errorKey: "rpe" })}
          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}-set_type`} className="text-xs">
              Set type
            </Label>
            <NativeSelect
              id={`${idPrefix}-set_type`}
              value={values.set_type}
              onChange={(e) => onChange({ ...values, set_type: e.target.value as SetType })}
            >
              {SET_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>
      )}
    </div>
  );
}
