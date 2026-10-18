"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api-client";
import type { UnitSystem } from "@/lib/units";
import type { TrackingMode } from "@/lib/workouts/types";
import { SetFields, setBodyFrom, setFieldsFrom } from "./set-fields";
import type { LoggedSet } from "./types";

export type EditableSet = Pick<LoggedSet, "id" | "set_number" | "weight_kg" | "reps" | "duration_s" | "distance_m"> &
  Partial<Pick<LoggedSet, "rpe" | "set_type" | "transcript">> & { exerciseName: string; mode: TrackingMode };

export function EditSetDialog(props: { set: EditableSet | null; units: UnitSystem; onClose: () => void }) {
  return (
    <Dialog open={!!props.set} onOpenChange={(open) => !open && props.onClose()}>
      {props.set && <EditSetForm key={props.set.id} set={props.set} units={props.units} onClose={props.onClose} />}
    </Dialog>
  );
}

function EditSetForm({ set, units, onClose }: { set: EditableSet; units: UnitSystem; onClose: () => void }) {
  const router = useRouter();
  const [values, setValues] = useState(() => setFieldsFrom(set, units));
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    const res = await api(`/api/workouts/sets/${set.id}`, { method: "PATCH", body: setBodyFrom(values, units) });
    setPending(false);
    if (!res.ok) {
      setErrors((res.details as Record<string, string[]>) ?? {});
      toast.error(res.message);
      return;
    }
    onClose();
    router.refresh();
  }

  async function remove() {
    setPending(true);
    const res = await api(`/api/workouts/sets/${set.id}`, { method: "DELETE" });
    setPending(false);
    if (!res.ok) return toast.error(res.message);
    onClose();
    router.refresh();
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>
          {set.exerciseName} — set {set.set_number}
        </DialogTitle>
        <DialogDescription>{set.transcript ? `Heard: “${set.transcript}”` : "Edit this set."}</DialogDescription>
      </DialogHeader>
      <SetFields idPrefix={`edit-${set.id}`} mode={set.mode} units={units} values={values} onChange={setValues} errors={errors} />
      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={remove} disabled={pending}>
          Delete set
        </Button>
        <Button type="button" onClick={save} disabled={pending}>
          Save changes
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
