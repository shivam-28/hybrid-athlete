"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/field";
import { NativeSelect } from "@/components/native-select";
import { FOCUS_LABELS, RUN_TYPE_LABELS } from "@/lib/coach/format";
import { WEEKDAYS } from "@/lib/coach/preferences";
import { PlanSessionSchema, RUN_TYPES, STRENGTH_FOCUS, type PlanSession } from "@/lib/coach/plan-schema";

const num = (v: FormDataEntryValue | null) => (v === null || v === "" ? null : Number(v));

/** Builds the edited session from the form; strength sessions keep their exercise list (sets/reps editable). */
function readSession(form: FormData, original: PlanSession): unknown {
  const type = String(form.get("type")) as PlanSession["type"];
  const title = String(form.get("title") ?? "").trim();
  const duration = num(form.get("duration_min"));
  switch (type) {
    case "run":
      return {
        type,
        title: title || "Run",
        run_type: form.get("run_type"),
        distance_km: num(form.get("distance_km")),
        duration_min: duration,
        hr_zone: num(form.get("hr_zone")),
        pace: (form.get("pace") as string) || null,
        notes: original.type === "run" ? original.notes ?? null : null,
      };
    case "strength":
      if (original.type !== "strength") return null;
      return {
        ...original,
        title: title || original.title,
        focus: form.get("focus"),
        duration_min: duration,
        exercises: original.exercises.flatMap((e, i) =>
          form.get(`remove_${i}`) ? [] : [{ ...e, sets: num(form.get(`sets_${i}`)), rep_min: num(form.get(`rep_min_${i}`)), rep_max: num(form.get(`rep_max_${i}`)) }],
        ),
      };
    case "core":
      return { type, title: title || "Core", duration_min: duration, exercises: original.type === "core" ? original.exercises : [], notes: null };
    case "mobility":
      return { type, title: title || "Mobility", duration_min: duration, notes: null };
    case "rest":
      return { type: "rest" };
  }
}

export function SessionEditor(props: {
  session: PlanSession;
  dayIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (session: PlanSession, dayIndex: number) => void;
}) {
  const { session } = props;
  const [type, setType] = useState<PlanSession["type"]>(session.type);
  const [error, setError] = useState<string | null>(null);
  const types: PlanSession["type"][] = session.type === "strength" ? ["strength", "run", "core", "mobility", "rest"] : ["run", "core", "mobility", "rest"];

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = PlanSessionSchema.safeParse(readSession(form, session));
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Check the fields.");
    setError(null);
    props.onSave({ ...parsed.data, id: session.id }, Number(form.get("day_index")));
  }

  const value = <K extends string>(key: K) => (key in session ? ((session as Record<string, unknown>)[key] as string | number | null) ?? "" : "");

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit session</DialogTitle>
          <DialogDescription>Safety checks re-run as soon as you save.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field id="edit-day" label="Day">
            <NativeSelect id="edit-day" name="day_index" defaultValue={props.dayIndex}>
              {WEEKDAYS.map((d, i) => (
                <option key={d} value={i}>{d}</option>
              ))}
            </NativeSelect>
          </Field>
          <Field id="edit-type" label="Type">
            <NativeSelect id="edit-type" name="type" value={type} onChange={(e) => setType(e.target.value as PlanSession["type"])}>
              {types.map((t) => (
                <option key={t} value={t}>{t[0]!.toUpperCase() + t.slice(1)}</option>
              ))}
            </NativeSelect>
          </Field>
          {type !== "rest" && (
            <Field id="edit-title" label="Title">
              <Input id="edit-title" name="title" defaultValue={value("title")} className="h-11" />
            </Field>
          )}
          {type === "run" && (
            <>
              <Field id="edit-run-type" label="Run type">
                <NativeSelect id="edit-run-type" name="run_type" defaultValue={session.type === "run" ? session.run_type : "easy"}>
                  {RUN_TYPES.map((t) => (
                    <option key={t} value={t}>{RUN_TYPE_LABELS[t]}</option>
                  ))}
                </NativeSelect>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field id="edit-distance" label="Distance (km)">
                  <Input id="edit-distance" name="distance_km" type="number" inputMode="decimal" step="0.1" defaultValue={value("distance_km")} className="h-11" />
                </Field>
                <Field id="edit-duration" label="Duration (min)">
                  <Input id="edit-duration" name="duration_min" type="number" inputMode="numeric" defaultValue={value("duration_min")} className="h-11" />
                </Field>
                <Field id="edit-zone" label="HR zone (1–5)">
                  <Input id="edit-zone" name="hr_zone" type="number" inputMode="numeric" min={1} max={5} defaultValue={value("hr_zone")} className="h-11" />
                </Field>
                <Field id="edit-pace" label="Pace (m:ss/km)">
                  <Input id="edit-pace" name="pace" placeholder="6:00" defaultValue={value("pace")} className="h-11" />
                </Field>
              </div>
            </>
          )}
          {(type === "strength" || type === "core" || type === "mobility") && (
            <Field id="edit-session-duration" label="Duration (min)">
              <Input id="edit-session-duration" name="duration_min" type="number" inputMode="numeric" defaultValue={value("duration_min") || 30} className="h-11" />
            </Field>
          )}
          {type === "strength" && session.type === "strength" && (
            <>
              <Field id="edit-focus" label="Focus">
                <NativeSelect id="edit-focus" name="focus" defaultValue={session.focus}>
                  {STRENGTH_FOCUS.map((f) => (
                    <option key={f} value={f}>{FOCUS_LABELS[f]}</option>
                  ))}
                </NativeSelect>
              </Field>
              <fieldset className="space-y-3">
                <legend className="text-sm font-medium">Exercises</legend>
                {session.exercises.map((e, i) => (
                  <div key={`${e.exercise_id}-${i}`} className="space-y-2 rounded-md border p-3">
                    <p className="text-sm font-medium">{e.name}</p>
                    <div className="grid grid-cols-3 gap-2">
                      <Input aria-label={`${e.name} sets`} name={`sets_${i}`} type="number" inputMode="numeric" defaultValue={e.sets} className="h-11" />
                      <Input aria-label={`${e.name} min reps`} name={`rep_min_${i}`} type="number" inputMode="numeric" defaultValue={e.rep_min} className="h-11" />
                      <Input aria-label={`${e.name} max reps`} name={`rep_max_${i}`} type="number" inputMode="numeric" defaultValue={e.rep_max} className="h-11" />
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name={`remove_${i}`} className="size-5" /> Remove
                    </label>
                  </div>
                ))}
              </fieldset>
            </>
          )}
          {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => props.onOpenChange(false)}>Cancel</Button>
            <Button type="submit">Save session</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
