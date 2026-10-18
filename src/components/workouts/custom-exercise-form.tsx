"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/field";
import { NativeSelect } from "@/components/native-select";
import { api } from "@/lib/api-client";
import { EQUIPMENT, MUSCLE_GROUPS, MUSCLE_LABELS, TRACKING_MODE_LABELS, type MuscleGroup, type TrackingMode } from "@/lib/workouts/types";

type Values = { name: string; equipment: string; tracking_mode: TrackingMode; primary: MuscleGroup[]; secondary: MuscleGroup[] };

function MuscleChecks(props: { legend: string; value: MuscleGroup[]; onChange: (v: MuscleGroup[]) => void; error?: string[] }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{props.legend}</legend>
      <div className="grid grid-cols-2 gap-2">
        {MUSCLE_GROUPS.map((g) => (
          <label key={g} className="flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm">
            <input
              type="checkbox"
              className="size-4"
              checked={props.value.includes(g)}
              onChange={(e) => props.onChange(e.target.checked ? [...props.value, g] : props.value.filter((x) => x !== g))}
            />
            {MUSCLE_LABELS[g]}
          </label>
        ))}
      </div>
      {props.error?.map((e) => <p key={e} className="text-destructive text-sm">{e}</p>)}
    </fieldset>
  );
}

export function CustomExerciseForm(props: { exerciseId?: string; initial?: Partial<Values> }) {
  const router = useRouter();
  const [values, setValues] = useState<Values>({ name: "", equipment: "", tracking_mode: "weight_reps", primary: [], secondary: [], ...props.initial });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    const body = { ...values, equipment: values.equipment || null };
    const res = props.exerciseId
      ? await api(`/api/exercises/${props.exerciseId}`, { method: "PATCH", body })
      : await api<{ exercise: { id: string } }>("/api/exercises", { body });
    setPending(false);
    if (!res.ok) {
      setErrors((res.details as Record<string, string[]>) ?? {});
      return toast.error(res.message);
    }
    const id = props.exerciseId ?? (res.data as { exercise: { id: string } }).exercise.id;
    router.push(`/train/exercises/${id}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <Field id="name" label="Name" errors={errors.name}>
        <Input id="name" required maxLength={100} value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} className="h-11" />
      </Field>
      <Field id="equipment" label="Equipment">
        <NativeSelect id="equipment" value={values.equipment} onChange={(e) => setValues({ ...values, equipment: e.target.value })}>
          <option value="">None / other</option>
          {EQUIPMENT.map((e) => <option key={e} value={e}>{e}</option>)}
        </NativeSelect>
      </Field>
      <Field id="tracking_mode" label="What you log">
        <NativeSelect id="tracking_mode" value={values.tracking_mode} onChange={(e) => setValues({ ...values, tracking_mode: e.target.value as TrackingMode })}>
          {Object.entries(TRACKING_MODE_LABELS).map(([mode, label]) => <option key={mode} value={mode}>{label}</option>)}
        </NativeSelect>
      </Field>
      <MuscleChecks legend="Primary muscle groups" value={values.primary} onChange={(primary) => setValues({ ...values, primary })} error={errors.primary} />
      <MuscleChecks legend="Secondary muscle groups (optional)" value={values.secondary} onChange={(secondary) => setValues({ ...values, secondary })} />
      <Button type="submit" className="h-11 w-full" disabled={pending}>
        {props.exerciseId ? "Save exercise" : "Create exercise"}
      </Button>
    </form>
  );
}
