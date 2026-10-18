"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/field";
import { NativeSelect } from "@/components/native-select";
import { api } from "@/lib/api-client";
import { RACE_DISTANCES, WEEKDAYS, raceDistanceKey, type TrainingPreferences } from "@/lib/coach/preferences";

type Errors = Record<string, string[] | undefined>;

export function TrainingPreferencesForm({ defaults }: { defaults: TrainingPreferences | null }) {
  const router = useRouter();
  const [race, setRace] = useState(raceDistanceKey(defaults?.race_distance_km ?? null));
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    const result = await api<{ preferences: TrainingPreferences }>("/api/coach/preferences", {
      method: "PUT",
      body: Object.fromEntries(new FormData(event.currentTarget)),
    });
    setPending(false);
    if (!result.ok) {
      setErrors((result.details as Errors) ?? {});
      setMessage(result.message);
      return;
    }
    setErrors({});
    setMessage("Saved.");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <Field id="days_per_week" label="Training days per week" errors={errors.days_per_week}>
        <NativeSelect id="days_per_week" name="days_per_week" defaultValue={defaults?.days_per_week ?? 4}>
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </NativeSelect>
      </Field>
      <Field id="max_session_min" label="Longest session (minutes)" hint="No session in your plan will be longer." errors={errors.max_session_min}>
        <Input id="max_session_min" name="max_session_min" type="number" inputMode="numeric" min={20} max={240} defaultValue={defaults?.max_session_min ?? 60} className="h-11" />
      </Field>
      <Field id="long_run_weekday" label="Long-run day" errors={errors.long_run_weekday}>
        <NativeSelect id="long_run_weekday" name="long_run_weekday" defaultValue={defaults?.long_run_weekday ?? 7}>
          {WEEKDAYS.map((day, i) => (
            <option key={day} value={i + 1}>{day}</option>
          ))}
        </NativeSelect>
      </Field>
      <Field id="equipment" label="Where you lift" errors={errors.equipment}>
        <NativeSelect id="equipment" name="equipment" defaultValue={defaults?.equipment ?? "gym"}>
          <option value="gym">Gym (full equipment)</option>
          <option value="home">Home (bodyweight, dumbbells, kettlebells, bands)</option>
        </NativeSelect>
      </Field>
      <Field id="race_distance" label="Target race" hint="Optional. Without a race the plan builds your aerobic base." errors={errors.race_distance}>
        <NativeSelect id="race_distance" name="race_distance" value={race} onChange={(e) => setRace(e.target.value as typeof race)}>
          <option value="none">No race yet</option>
          {Object.entries(RACE_DISTANCES).map(([key, d]) => (
            <option key={key} value={key}>{d.label}</option>
          ))}
          <option value="custom">Other distance</option>
        </NativeSelect>
      </Field>
      {race === "custom" && (
        <Field id="race_distance_custom_km" label="Race distance (km)" errors={errors.race_distance_custom_km}>
          <Input id="race_distance_custom_km" name="race_distance_custom_km" type="number" inputMode="decimal" step="0.1" defaultValue={defaults?.race_distance_km ?? ""} className="h-11" />
        </Field>
      )}
      {race !== "none" && (
        <>
          <Field id="race_date" label="Race date" errors={errors.race_date}>
            <Input id="race_date" name="race_date" type="date" defaultValue={defaults?.race_date ?? ""} className="h-11" />
          </Field>
          <Field id="race_goal_time" label="Goal time (optional)" hint="h:mm, e.g. 3:59" errors={errors.race_goal_time}>
            <Input id="race_goal_time" name="race_goal_time" placeholder="3:59" defaultValue={defaults?.race_goal_time?.replace(/:00$/, "") ?? ""} className="h-11" />
          </Field>
        </>
      )}
      {message && (
        <p role={message === "Saved." ? "status" : "alert"} className={message === "Saved." ? "text-sm text-green-600" : "text-destructive text-sm"}>
          {message}
        </p>
      )}
      <Button type="submit" className="h-11 w-full" disabled={pending}>
        Save preferences
      </Button>
    </form>
  );
}
