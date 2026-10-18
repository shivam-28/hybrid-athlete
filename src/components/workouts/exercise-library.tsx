"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/native-select";
import { EQUIPMENT, MUSCLE_GROUPS, MUSCLE_LABELS } from "@/lib/workouts/types";
import { useExerciseSearch } from "./exercise-picker";

export function ExerciseLibrary() {
  const [q, setQ] = useState("");
  const [muscle, setMuscle] = useState("");
  const [equipment, setEquipment] = useState("");
  const results = useExerciseSearch(q, { muscle, equipment });

  return (
    <div className="space-y-4">
      <Input aria-label="Search exercises" placeholder="Search exercises" value={q} onChange={(e) => setQ(e.target.value)} className="h-11 text-base" />
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="muscle" className="text-xs">Muscle group</Label>
          <NativeSelect id="muscle" value={muscle} onChange={(e) => setMuscle(e.target.value)}>
            <option value="">All</option>
            {MUSCLE_GROUPS.map((g) => <option key={g} value={g}>{MUSCLE_LABELS[g]}</option>)}
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <Label htmlFor="equipment" className="text-xs">Equipment</Label>
          <NativeSelect id="equipment" value={equipment} onChange={(e) => setEquipment(e.target.value)}>
            <option value="">All</option>
            {EQUIPMENT.map((e) => <option key={e} value={e}>{e}</option>)}
          </NativeSelect>
        </div>
      </div>

      {results?.length === 0 ? (
        <div className="space-y-3 rounded-xl border border-dashed p-4 text-sm">
          <p>No exercises match{q ? ` “${q}”` : ""}.</p>
          <Button asChild className="h-11 w-full">
            <Link href={`/train/exercises/new${q ? `?name=${encodeURIComponent(q)}` : ""}`}>
              <Plus /> Create {q ? `“${q}”` : "a custom exercise"}
            </Link>
          </Button>
        </div>
      ) : (
        <ul className="divide-y rounded-md border" aria-label="Exercises">
          {results?.map((r) => (
            <li key={r.id}>
              <Link href={`/train/exercises/${r.id}`} className="hover:bg-accent flex min-h-12 flex-col justify-center px-3 py-2">
                <span className="font-medium">{r.name}</span>
                <span className="text-muted-foreground text-xs">
                  {[r.primary_groups.map((g) => MUSCLE_LABELS[g]).join(", "), r.equipment, r.is_custom && "custom"].filter(Boolean).join(" · ")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Button asChild variant="outline" className="h-11 w-full">
        <Link href="/train/exercises/new"><Plus /> Custom exercise</Link>
      </Button>
    </div>
  );
}
