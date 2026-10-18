"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api-client";
import type { UnitSystem } from "@/lib/units";
import type { TrackingMode } from "@/lib/workouts/types";
import { ExercisePicker } from "./exercise-picker";
import { SetFields, setBodyFrom, setFieldsFrom } from "./set-fields";
import type { ExerciseRef } from "./types";

export type VoiceDraft = {
  phrase: string | null;
  exerciseId: string | null;
  sets: { weight_kg: number | null; reps: number | null; duration_s: number | null; distance_m: number | null }[];
  candidates: ExerciseRef[];
  parsedBy: "grammar" | "ai";
  aiUnavailable: boolean;
};
export type SavedSets = {
  status: "saved";
  sets: {
    id: string;
    exerciseName: string;
    trackingMode: TrackingMode;
    set_number: number;
    summary: string;
    weight_kg: number | null;
    reps: number | null;
    duration_s: number | null;
    distance_m: number | null;
  }[];
};

export function ConfirmationCard(props: {
  draft: VoiceDraft;
  transcript: string;
  source: "voice" | "text";
  units: UnitSystem;
  onSaved: (outcome: SavedSets) => void;
  onDismiss: () => void;
}) {
  const { draft, units } = props;
  const [candidates, setCandidates] = useState(draft.candidates);
  const [chosenId, setChosenId] = useState(draft.exerciseId ?? draft.candidates[0]?.id ?? null);
  const [sets, setSets] = useState(() => (draft.sets.length ? draft.sets : [{ weight_kg: null, reps: null, duration_s: null, distance_m: null }]).map((s) => setFieldsFrom(s, units)));
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const chosen = candidates.find((c) => c.id === chosenId) ?? null;

  async function confirm() {
    if (!chosen) return;
    setPending(true);
    const res = await api<SavedSets>("/api/workouts/voice/confirm", {
      body: {
        phrase: draft.phrase,
        exerciseId: chosen.id,
        sets: sets.map((s) => {
          const { weight_kg, reps, duration_s, distance_m } = setBodyFrom(s, units);
          return { weight_kg, reps, duration_s, distance_m };
        }),
        source: props.source,
        transcript: props.transcript,
      },
    });
    setPending(false);
    if (!res.ok) {
      setErrors((res.details as Record<string, string[]>) ?? {});
      return toast.error(res.message);
    }
    props.onSaved(res.data);
  }

  return (
    <Card role="region" aria-label="Confirm set" className="border-amber-500/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Is this right?</CardTitle>
        <p className="text-muted-foreground text-sm">Heard: “{props.transcript}”</p>
        {draft.parsedBy === "ai" && (
          <p className="flex items-center gap-1 text-xs text-amber-600">
            <Sparkles className="size-3" /> Interpreted by AI — check the values.
          </p>
        )}
        {draft.aiUnavailable && <p className="text-muted-foreground text-xs">AI parsing was unavailable, so this is the best automatic guess.</p>}
      </CardHeader>
      <CardContent className="space-y-4">
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Exercise</legend>
          {candidates.map((c) => (
            <label key={c.id} className="flex min-h-11 items-center gap-3 rounded-md border px-3">
              <input type="radio" name="exercise" checked={chosenId === c.id} onChange={() => setChosenId(c.id)} className="size-4" />
              <span>{c.name}</span>
            </label>
          ))}
          <Button type="button" variant="link" className="px-0" onClick={() => setPickerOpen(true)}>
            Choose a different exercise
          </Button>
        </fieldset>
        {chosen &&
          sets.map((values, i) => (
            <div key={i} className="space-y-1">
              {sets.length > 1 && <p className="text-muted-foreground text-xs">Set {i + 1}</p>}
              <SetFields
                idPrefix={`confirm-${i}`}
                mode={chosen.tracking_mode}
                units={units}
                values={values}
                compact
                errors={errors}
                onChange={(v) => setSets((all) => all.map((s, j) => (j === i ? v : s)))}
              />
            </div>
          ))}
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="h-11 flex-1" onClick={props.onDismiss}>
            Dismiss
          </Button>
          <Button type="button" className="h-11 flex-1" disabled={!chosen || pending} onClick={confirm}>
            Save set{sets.length > 1 ? "s" : ""}
          </Button>
        </div>
      </CardContent>
      <ExercisePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onPick={(exercise) => {
          setCandidates((all) => [exercise, ...all.filter((c) => c.id !== exercise.id)]);
          setChosenId(exercise.id);
        }}
      />
    </Card>
  );
}
