"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/field";
import { NativeSelect } from "@/components/native-select";
import type { NutritionPreferences } from "@/lib/nutrition/preferences";
import { updateNutritionPreferences } from "@/server/nutrition-actions";

export function PreferencesForm({ defaults }: { defaults: NutritionPreferences }) {
  const [state, formAction, pending] = useActionState(updateNutritionPreferences, {});
  const errors = state.fieldErrors ?? {};
  return (
    <form action={formAction} className="space-y-5">
      <Field
        id="lifestyle_level"
        label="Activity outside workouts"
        hint="Your everyday movement, not training. Workouts and runs are added on top each day."
        errors={errors.lifestyle_level}
      >
        <NativeSelect id="lifestyle_level" name="lifestyle_level" defaultValue={defaults.lifestyle_level}>
          <option value="sedentary">Sedentary: desk job, little walking (×1.2)</option>
          <option value="lightly_active">Lightly active: on your feet part of the day (×1.35)</option>
          <option value="active">Active: physical job or lots of walking (×1.5)</option>
        </NativeSelect>
      </Field>
      <Field id="diet_type" label="Diet" errors={errors.diet_type}>
        <NativeSelect id="diet_type" name="diet_type" defaultValue={defaults.diet_type}>
          <option value="omnivore">Omnivore</option>
          <option value="pescatarian">Pescatarian</option>
          <option value="vegetarian">Vegetarian</option>
          <option value="vegan">Vegan</option>
        </NativeSelect>
      </Field>
      <Field id="allergies" label="Allergies" hint="Comma-separated, e.g. peanuts, milk. Suggestions containing these are always removed." errors={errors.allergies}>
        <Input id="allergies" name="allergies" defaultValue={defaults.allergies.join(", ")} className="h-11" />
      </Field>
      <Field id="dislikes" label="Foods you dislike" hint="Comma-separated." errors={errors.dislikes}>
        <Input id="dislikes" name="dislikes" defaultValue={defaults.dislikes.join(", ")} className="h-11" />
      </Field>
      <Field id="cuisines" label="Favourite cuisines" hint="Comma-separated, e.g. Indian, Nordic." errors={errors.cuisines}>
        <Input id="cuisines" name="cuisines" defaultValue={defaults.cuisines.join(", ")} className="h-11" />
      </Field>
      {state.formError && <p role="alert" className="text-destructive text-sm">{state.formError}</p>}
      {state.ok && <p role="status" className="text-sm text-green-600">Saved.</p>}
      <Button type="submit" className="h-11 w-full" disabled={pending}>
        Save nutrition preferences
      </Button>
    </form>
  );
}
