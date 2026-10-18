"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/field";
import { NativeSelect } from "@/components/native-select";
import { checkConsistency } from "@/lib/body/composition";
import { COMP_METHODS, METHOD_LABELS, SEGMENTS } from "@/lib/body/schemas";
import { kgToLb, lbToKg, type UnitSystem } from "@/lib/units";
import { cn } from "@/lib/utils";

export type CompositionFormValues = Record<string, string>;

const MASS = ["weight", "fat_mass", "lean_mass", "skeletal_muscle", "total_body_water"] as const;
const FIELDS: { name: string; label: string; mass?: boolean; step?: string }[] = [
  { name: "weight", label: "Weight", mass: true },
  { name: "body_fat_pct", label: "Body fat (%)" },
  { name: "fat_mass", label: "Fat mass", mass: true },
  { name: "lean_mass", label: "Lean (fat-free) mass", mass: true },
  { name: "skeletal_muscle", label: "Skeletal muscle mass", mass: true },
  { name: "total_body_water", label: "Total body water", mass: true },
  { name: "visceral_fat_level", label: "Visceral fat level" },
  { name: "bmr_kcal", label: "Device BMR (kcal)", step: "1" },
];
const SEGMENT_LABELS = { left_arm: "Left arm", right_arm: "Right arm", trunk: "Trunk", left_leg: "Left leg", right_leg: "Right leg" } as const;

/** Converts a kg-based draft/row into form strings in the user's display unit. */
export function toFormValues(source: Record<string, unknown>, units: UnitSystem): CompositionFormValues {
  const segments = (source.segmental_lean ?? null) as Record<string, number> | null;
  const display = (field: string, v: unknown) =>
    v === null || v === undefined ? "" : MASS.includes(field as (typeof MASS)[number]) && units === "imperial" ? String(kgToLb(Number(v))) : String(v);
  const values: CompositionFormValues = {};
  for (const f of FIELDS) values[f.name] = display(f.name, source[f.name]);
  for (const s of SEGMENTS) values[`seg_${s}`] = display("weight", segments?.[s]);
  values.method = String(source.method ?? "");
  values.test_date = String(source.test_date ?? "");
  return values;
}

/** Form strings → the JSON shape the API validates (masses in the display unit). */
export function toPayload(values: CompositionFormValues, units: UnitSystem) {
  const segmental = Object.fromEntries(SEGMENTS.map((s) => [s, values[`seg_${s}`] ?? ""]));
  return {
    method: values.method,
    test_date: values.test_date,
    unit: units === "metric" ? "kg" : "lb",
    ...Object.fromEntries(FIELDS.map((f) => [f.name, values[f.name] ?? ""])),
    segmental_lean: segmental,
  };
}

const kgOf = (v: string | undefined, units: UnitSystem) => {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? (units === "metric" ? n : lbToKg(n)) : null;
};

export function CompositionForm(props: {
  initial: CompositionFormValues;
  notFound?: string[];
  units: UnitSystem;
  submitLabel: string;
  fieldErrors?: Record<string, string[] | undefined>;
  pending?: boolean;
  onSubmit: (values: CompositionFormValues) => void;
  secondary?: React.ReactNode;
}) {
  const [values, setValues] = useState(props.initial);
  const unit = props.units === "metric" ? "kg" : "lb";
  const notFound = new Set(props.notFound ?? []);
  const set = (name: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setValues((v) => ({ ...v, [name]: e.target.value }));

  const warnings = useMemo(
    () =>
      checkConsistency({
        weight_kg: kgOf(values.weight, props.units),
        fat_mass_kg: kgOf(values.fat_mass, props.units),
        lean_mass_kg: kgOf(values.lean_mass, props.units),
        body_fat_pct: values.body_fat_pct ? Number(values.body_fat_pct) : null,
      }),
    [values, props.units],
  );
  const flagged = new Set(warnings.flatMap((w) => w.fields.map((f) => f.replace(/_kg$/, ""))));

  const hint = (name: string) => (notFound.has(name) && !values[name] ? "Not found on the report" : undefined);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        props.onSubmit(values);
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 gap-3">
        <Field id="method" label="Method" hint={hint("method")} errors={props.fieldErrors?.method}>
          <NativeSelect id="method" value={values.method} onChange={set("method")}>
            <option value="">Select…</option>
            {COMP_METHODS.map((m) => (
              <option key={m} value={m}>{METHOD_LABELS[m]}</option>
            ))}
          </NativeSelect>
        </Field>
        <Field id="test_date" label="Test date" hint={hint("test_date")} errors={props.fieldErrors?.test_date}>
          <Input id="test_date" type="date" value={values.test_date} onChange={set("test_date")} className="h-11" required />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {FIELDS.map((f) => {
          const id = `comp-${f.name}`;
          return (
            <Field key={f.name} id={id} label={f.mass ? `${f.label} (${unit})` : f.label} hint={hint(f.name)} errors={props.fieldErrors?.[f.name]}>
              <Input
                id={id}
                type="number"
                inputMode="decimal"
                step={f.step ?? "0.1"}
                value={values[f.name] ?? ""}
                onChange={set(f.name)}
                aria-invalid={flagged.has(f.name) || undefined}
                className={cn("h-11", flagged.has(f.name) && "border-amber-500 ring-2 ring-amber-500/30")}
              />
            </Field>
          );
        })}
      </div>

      <details className="rounded-md border p-3">
        <summary className="min-h-11 cursor-pointer content-center text-sm font-medium">Segmental lean mass ({unit})</summary>
        <div className="grid grid-cols-2 gap-3 pt-3">
          {SEGMENTS.map((s) => (
            <Field key={s} id={`seg-${s}`} label={SEGMENT_LABELS[s]}>
              <Input id={`seg-${s}`} type="number" inputMode="decimal" step="0.1" value={values[`seg_${s}`] ?? ""} onChange={set(`seg_${s}`)} className="h-11" />
            </Field>
          ))}
        </div>
      </details>

      {warnings.length > 0 && (
        <ul role="alert" aria-label="Consistency warnings" className="space-y-1 rounded-md border border-amber-500/60 bg-amber-500/10 p-3 text-sm">
          {warnings.map((w) => (
            <li key={w.code}>{w.message}</li>
          ))}
          <li className="text-muted-foreground">You can still save if these values are correct.</li>
        </ul>
      )}
      <p className="text-muted-foreground text-xs">Missing fat mass, lean mass or body fat % are calculated from the others and marked as derived.</p>
      <div className="flex flex-col gap-2">
        <Button type="submit" className="h-11 w-full" disabled={props.pending}>{props.submitLabel}</Button>
        {props.secondary}
      </div>
    </form>
  );
}
