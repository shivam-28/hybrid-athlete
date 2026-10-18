"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import { MUSCLE_LABELS, type MuscleGroup } from "@/lib/workouts/types";
import type { ExerciseRef } from "./types";

type Result = ExerciseRef & { equipment: string | null; primary_groups: MuscleGroup[]; is_custom: boolean };

export function useExerciseSearch(query: string, filters: { muscle?: string; equipment?: string } = {}) {
  const [results, setResults] = useState<Result[] | null>(null);
  useEffect(() => {
    const params = new URLSearchParams({ q: query, ...(filters.muscle && { muscle: filters.muscle }), ...(filters.equipment && { equipment: filters.equipment }) });
    const timer = setTimeout(async () => {
      const res = await api<{ exercises: Result[] }>(`/api/exercises?${params}`);
      if (res.ok) setResults(res.data.exercises);
    }, 200);
    return () => clearTimeout(timer);
  }, [query, filters.muscle, filters.equipment]);
  return results;
}

export function ExercisePicker(props: { open: boolean; onOpenChange: (open: boolean) => void; onPick: (exercise: ExerciseRef) => void }) {
  const [query, setQuery] = useState("");
  const results = useExerciseSearch(query);

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Add exercise</DialogTitle>
        </DialogHeader>
        <Input
          aria-label="Search exercises"
          placeholder="Search, e.g. dumbbell shoulder press"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-11 text-base"
          autoFocus
        />
        <ul className="-mx-2 max-h-[55dvh] overflow-y-auto">
          {results?.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                className="hover:bg-accent flex min-h-11 w-full flex-col items-start rounded-md px-2 py-2 text-left"
                onClick={() => {
                  props.onPick({ id: r.id, name: r.name, tracking_mode: r.tracking_mode });
                  props.onOpenChange(false);
                  setQuery("");
                }}
              >
                <span className="font-medium">{r.name}</span>
                <span className="text-muted-foreground text-xs">
                  {[r.primary_groups.map((g) => MUSCLE_LABELS[g]).join(", "), r.equipment, r.is_custom && "custom"].filter(Boolean).join(" · ")}
                </span>
              </button>
            </li>
          ))}
          {results?.length === 0 && <li className="text-muted-foreground px-2 py-4 text-sm">No exercises found.</li>}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
