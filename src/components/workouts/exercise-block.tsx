"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageSquareText, Pencil, Repeat2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api-client";
import type { UnitSystem } from "@/lib/units";
import { formatSetValues } from "@/lib/workouts/history";
import type { Suggestion } from "@/lib/workouts/progression";
import { cn } from "@/lib/utils";
import { SetFields, emptySetFields, setBodyFrom } from "./set-fields";
import { SuggestionPanel } from "./suggestion-panel";
import type { EditableSet } from "./edit-set-dialog";
import type { ExerciseRef, LoggedSet } from "./types";

type Context = { previous: { localDate: string; summary: string } | null; suggestion: Suggestion };

export function ExerciseBlock(props: {
  exercise: ExerciseRef;
  sets: LoggedSet[];
  units: UnitSystem;
  active: boolean;
  canLog: boolean;
  onActivate: () => void;
  onEditSet: (set: EditableSet) => void;
}) {
  const { exercise, units } = props;
  const router = useRouter();
  const [context, setContext] = useState<Context | null>(null);
  const [values, setValues] = useState(emptySetFields);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api<Context>(`/api/exercises/${exercise.id}/context`).then((res) => {
      if (!cancelled && res.ok) setContext(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [exercise.id]);

  async function logSet(event: React.FormEvent) {
    event.preventDefault();
    props.onActivate();
    setPending(true);
    const res = await api("/api/workouts/sets", { body: { exercise_id: exercise.id, ...setBodyFrom(values, units) } });
    setPending(false);
    if (!res.ok) {
      setErrors((res.details as Record<string, string[]>) ?? {});
      toast.error(res.message);
      return;
    }
    setErrors({});
    // Keep weight/duration for the next set; reps usually change.
    setValues((v) => ({ ...v, reps: "", rpe: "" }));
    router.refresh();
  }

  async function repeatLast() {
    props.onActivate();
    const res = await api("/api/workouts/sets/repeat", { body: { exercise_id: exercise.id } });
    if (!res.ok) return toast.error(res.message);
    router.refresh();
  }

  return (
    <Card className={cn(props.active && "ring-primary/40 ring-2")} onFocusCapture={props.onActivate}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <Link href={`/train/exercises/${exercise.id}`} className="hover:underline">
            {exercise.name}
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {context && <SuggestionPanel previous={context.previous} suggestion={context.suggestion} units={units} />}

        {props.sets.length > 0 && (
          <ol className="divide-y rounded-md border" aria-label={`${exercise.name} sets`}>
            {props.sets.map((s) => (
              <li key={s.id} className="flex min-h-11 items-center gap-3 px-3 text-sm">
                <span className="text-muted-foreground w-12 tabular-nums">Set {s.set_number}</span>
                <span className="flex-1">
                  {formatSetValues(s, units, exercise.tracking_mode)}
                  {s.rpe !== null && <span className="text-muted-foreground"> @ RPE {s.rpe}</span>}
                  {s.set_type !== "working" && <span className="text-muted-foreground"> · {s.set_type}</span>}
                </span>
                {s.transcript && <MessageSquareText className="text-muted-foreground size-4" aria-label={`Heard: ${s.transcript}`} />}
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Edit set ${s.set_number}`}
                  onClick={() => props.onEditSet({ ...s, exerciseName: exercise.name, mode: exercise.tracking_mode })}
                >
                  <Pencil />
                </Button>
              </li>
            ))}
          </ol>
        )}

        {props.canLog && (
          <form onSubmit={logSet} className="space-y-3">
            <SetFields idPrefix={`log-${exercise.id}`} mode={exercise.tracking_mode} units={units} values={values} onChange={setValues} errors={errors} />
            <div className="flex gap-2">
              <Button type="submit" className="h-11 flex-1" disabled={pending}>
                Log set
              </Button>
              {props.sets.length > 0 && (
                <Button type="button" variant="outline" className="h-11" onClick={repeatLast}>
                  <Repeat2 /> Repeat last set
                </Button>
              )}
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
