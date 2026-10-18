"use client";

import { useActionState, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/field";
import { NativeSelect } from "@/components/native-select";
import { RUNNING_LEVELS, STRENGTH_LEVELS } from "@/lib/profile-schema";
import { DEFAULT_TIMEZONE, isValidTimezone } from "@/lib/time";
import { cmToFeetInches, type UnitSystem } from "@/lib/units";
import type { ProfileFormState } from "@/server/profile-actions";

type ProfileDefaults = {
  display_name: string;
  sex: string;
  birth_date: string;
  height_cm: number | null;
  unit_system: UnitSystem;
  timezone: string | null;
  strength_experience: string;
  running_experience: string;
  max_hr_bpm?: number | null;
};

const label = (s: string) => s[0]!.toUpperCase() + s.slice(1);

const noSubscribe = () => () => {};

function browserTimezone(): string {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return tz && isValidTimezone(tz) ? tz : DEFAULT_TIMEZONE;
}

/** Browser-only values: the server renders the fallback, the client swaps in the real value after hydration. */
function useBrowserTimezones() {
  const detected = useSyncExternalStore(noSubscribe, browserTimezone, () => DEFAULT_TIMEZONE);
  const all = useSyncExternalStore(
    noSubscribe,
    () => timezoneList,
    () => null,
  );
  return { detected, all };
}

const timezoneList: string[] = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];

export function ProfileForm(props: {
  action: (state: ProfileFormState, formData: FormData) => Promise<ProfileFormState>;
  defaults?: ProfileDefaults;
  submitLabel: string;
  /** Max HR is a settings-only refinement; onboarding stays short. */
  showMaxHr?: boolean;
}) {
  const [state, formAction, pending] = useActionState(props.action, {});
  const d = props.defaults;
  const [units, setUnits] = useState<UnitSystem>(d?.unit_system ?? "metric");
  const browser = useBrowserTimezones();
  const [chosenTimezone, setChosenTimezone] = useState<string | null>(null);
  const timezone = chosenTimezone ?? d?.timezone ?? browser.detected;
  const timezones = browser.all?.includes(timezone) ? browser.all : [timezone, ...(browser.all ?? [])];
  const ftIn = d?.height_cm ? cmToFeetInches(d.height_cm) : undefined;
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-5">
      <Field id="display_name" label="Display name" errors={errors.display_name}>
        <Input id="display_name" name="display_name" required maxLength={60} defaultValue={d?.display_name} className="h-11" />
      </Field>

      <Field id="sex" label="Sex" hint="Used only for metabolic and heart-rate formulas." errors={errors.sex}>
        <NativeSelect id="sex" name="sex" required defaultValue={d?.sex ?? ""}>
          <option value="" disabled>Select…</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </NativeSelect>
      </Field>

      <Field id="birth_date" label="Date of birth" errors={errors.birth_date}>
        <Input id="birth_date" name="birth_date" type="date" required defaultValue={d?.birth_date} className="h-11" />
      </Field>

      <Field id="unit_system" label="Units">
        <NativeSelect
          id="unit_system"
          name="unit_system"
          value={units}
          onChange={(e) => setUnits(e.target.value as UnitSystem)}
        >
          <option value="metric">Metric (kg, cm, km)</option>
          <option value="imperial">Imperial (lb, ft/in, mi)</option>
        </NativeSelect>
      </Field>

      {units === "metric" ? (
        <Field id="height_cm" label="Height (cm)" errors={errors.height_cm}>
          <Input id="height_cm" name="height_cm" type="number" inputMode="decimal" step="0.1" required defaultValue={d?.height_cm ?? ""} className="h-11" />
        </Field>
      ) : (
        <Field id="height_ft" label="Height (ft / in)" errors={errors.height_cm}>
          <div className="flex gap-2">
            <Input id="height_ft" name="height_ft" type="number" inputMode="numeric" aria-label="Feet" required defaultValue={ftIn?.feet} className="h-11" />
            <Input name="height_in" type="number" inputMode="numeric" aria-label="Inches" defaultValue={ftIn?.inches} className="h-11" />
          </div>
        </Field>
      )}

      <Field id="timezone" label="Timezone" hint="Decides which day your workouts and meals belong to." errors={errors.timezone}>
        <NativeSelect id="timezone" name="timezone" value={timezone} onChange={(e) => setChosenTimezone(e.target.value)}>
          {timezones.map((tz) => (
            <option key={tz} value={tz}>{tz}</option>
          ))}
        </NativeSelect>
      </Field>

      <Field id="strength_experience" label="Strength training experience" errors={errors.strength_experience}>
        <NativeSelect id="strength_experience" name="strength_experience" required defaultValue={d?.strength_experience ?? ""}>
          <option value="" disabled>Select…</option>
          {STRENGTH_LEVELS.map((l) => <option key={l} value={l}>{label(l)}</option>)}
        </NativeSelect>
      </Field>

      <Field id="running_experience" label="Running experience" errors={errors.running_experience}>
        <NativeSelect id="running_experience" name="running_experience" required defaultValue={d?.running_experience ?? ""}>
          <option value="" disabled>Select…</option>
          {RUNNING_LEVELS.map((l) => <option key={l} value={l}>{l === "none" ? "None yet" : label(l)}</option>)}
        </NativeSelect>
      </Field>

      {props.showMaxHr && (
        <Field
          id="max_hr_bpm"
          label="Max heart rate (bpm, optional)"
          hint="Leave blank to estimate from your age (208 − 0.7 × age). Sets your heart-rate zones; changing it recalculates all activities."
          errors={errors.max_hr_bpm}
        >
          <Input id="max_hr_bpm" name="max_hr_bpm" type="number" inputMode="numeric" defaultValue={d?.max_hr_bpm ?? ""} className="h-11" />
        </Field>
      )}

      {state.formError && <p role="alert" className="text-destructive text-sm">{state.formError}</p>}
      {state.ok && <p role="status" className="text-sm text-green-600">Saved.</p>}
      <Button type="submit" className="h-11 w-full" disabled={pending}>
        {props.submitLabel}
      </Button>
    </form>
  );
}
