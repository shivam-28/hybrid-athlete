"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api-client";
import type { UnitSystem } from "@/lib/units";
import { ConfirmationCard, type SavedSets, type VoiceDraft } from "./confirmation-card";
import { EditSetDialog, type EditableSet } from "./edit-set-dialog";
import { ExerciseBlock } from "./exercise-block";
import { ExercisePicker } from "./exercise-picker";
import type { ExerciseRef, SessionBlock } from "./types";
import { VoiceBar } from "./voice-bar";

type VoiceOutcome = SavedSets | { status: "needs_confirmation"; draft: VoiceDraft } | { status: "nothing_to_repeat" };
type PendingConfirmation = { draft: VoiceDraft; transcript: string; source: "voice" | "text" };

const UNDO_MS = 10_000;

export function WorkoutLogger(props: {
  session: { id: string; local_date: string; durationMinutes: number } | null;
  blocks: SessionBlock[];
  units: UnitSystem;
}) {
  const router = useRouter();
  const [opened, setOpened] = useState<ExerciseRef[]>([]);
  const [activeExerciseId, setActiveExerciseId] = useState<string | null>(props.blocks.at(-1)?.exercise.id ?? null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmNewOpen, setConfirmNewOpen] = useState(false);
  const [editing, setEditing] = useState<EditableSet | null>(null);
  const [confirmation, setConfirmation] = useState<PendingConfirmation | null>(null);
  const [pending, setPending] = useState(false);

  const blocks: SessionBlock[] = [
    ...props.blocks,
    ...opened.filter((e) => !props.blocks.some((b) => b.exercise.id === e.id)).map((exercise) => ({ exercise, sets: [] })),
  ];

  function announceSaved(outcome: SavedSets) {
    const first = outcome.sets[0];
    if (!first) return;
    const setNumbers = outcome.sets.map((s) => s.set_number).join(", ");
    toast.success(`${first.exerciseName} — set ${setNumbers}: ${first.summary}`, {
      duration: UNDO_MS,
      action: {
        label: "Undo",
        onClick: async () => {
          for (const s of [...outcome.sets].reverse()) await api(`/api/workouts/sets/${s.id}`, { method: "DELETE" });
          router.refresh();
        },
      },
      cancel: {
        label: "Edit",
        onClick: () => setEditing({ ...first, mode: first.trackingMode }),
      },
    });
    router.refresh();
  }

  async function submitPhrase(transcript: string, source: "voice" | "text") {
    setPending(true);
    const res = await api<VoiceOutcome>("/api/workouts/voice", { body: { transcript, source, activeExerciseId } });
    setPending(false);
    if (!res.ok) return toast.error(res.message);
    const outcome = res.data;
    if (outcome.status === "saved") announceSaved(outcome);
    else if (outcome.status === "nothing_to_repeat") toast.info("There's no previous set in this session to repeat.");
    else setConfirmation({ draft: outcome.draft, transcript, source });
  }

  async function startSession(finishActive: boolean) {
    const res = await api("/api/workouts/sessions", { body: { finishActive } });
    if (!res.ok) return toast.error(res.message);
    setOpened([]);
    setConfirmNewOpen(false);
    router.refresh();
  }

  async function finish() {
    if (!props.session) return;
    const res = await api(`/api/workouts/sessions/${props.session.id}/finish`, { method: "POST" });
    if (!res.ok) return toast.error(res.message);
    setOpened([]);
    toast.success("Workout finished. Nice work!");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <VoiceBar pending={pending} onSubmit={submitPhrase} />

      {confirmation && (
        <ConfirmationCard
          key={confirmation.transcript}
          draft={confirmation.draft}
          transcript={confirmation.transcript}
          source={confirmation.source}
          units={props.units}
          onDismiss={() => setConfirmation(null)}
          onSaved={(outcome) => {
            setConfirmation(null);
            announceSaved(outcome);
          }}
        />
      )}

      {props.session ? (
        <p className="text-muted-foreground text-sm" aria-live="polite">
          Session in progress · {props.session.durationMinutes} min
        </p>
      ) : (
        <div className="rounded-xl border border-dashed p-4 text-sm">
          <p className="mb-3">No workout in progress. Log a set (by voice or below) and a session starts automatically.</p>
          <Button className="h-11 w-full" onClick={() => startSession(false)}>
            Start workout
          </Button>
        </div>
      )}

      {blocks.map((b) => (
        <ExerciseBlock
          key={b.exercise.id}
          exercise={b.exercise}
          sets={b.sets}
          units={props.units}
          active={activeExerciseId === b.exercise.id}
          canLog
          onActivate={() => setActiveExerciseId(b.exercise.id)}
          onEditSet={setEditing}
        />
      ))}

      <Button variant="outline" className="h-11 w-full" onClick={() => setPickerOpen(true)}>
        <Plus /> Add exercise
      </Button>

      {props.session && (
        <div className="flex gap-2">
          <Button variant="secondary" className="h-11 flex-1" onClick={finish}>
            Finish workout
          </Button>
          <Button variant="ghost" className="h-11" onClick={() => setConfirmNewOpen(true)}>
            New session
          </Button>
        </div>
      )}

      <ExercisePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onPick={(exercise) => {
          setOpened((all) => (all.some((e) => e.id === exercise.id) ? all : [...all, exercise]));
          setActiveExerciseId(exercise.id);
        }}
      />
      <EditSetDialog set={editing} units={props.units} onClose={() => setEditing(null)} />
      <Dialog open={confirmNewOpen} onOpenChange={setConfirmNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finish the current session first?</DialogTitle>
            <DialogDescription>You can only have one workout in progress. Finish this one and start a new one?</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="outline">Keep going</Button>
            </DialogClose>
            <Button onClick={() => startSession(true)}>Finish and start new</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
