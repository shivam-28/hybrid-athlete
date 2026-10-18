"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
import type { TrackingMode } from "@/lib/workouts/types";

type Settings = { rep_min: number | null; rep_max: number | null; increment_kg: number | null; duration_increment_s: number | null };
type Defaults = { repMin: number; repMax: number; incrementKg: number; durationIncrementS: number };

export function ProgressionSettingsForm(props: { exerciseId: string; mode: TrackingMode; settings: Settings | null; defaults: Defaults }) {
  const router = useRouter();
  const str = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));
  const [v, setV] = useState({
    rep_min: str(props.settings?.rep_min),
    rep_max: str(props.settings?.rep_max),
    increment_kg: str(props.settings?.increment_kg),
    duration_increment_s: str(props.settings?.duration_increment_s),
  });
  const num = (s: string) => (s.trim() === "" ? null : Number(s));
  const isDuration = props.mode === "duration" || props.mode === "distance_duration";

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const res = await api(`/api/exercises/${props.exerciseId}/settings`, {
      method: "PUT",
      body: { rep_min: num(v.rep_min), rep_max: num(v.rep_max), increment_kg: num(v.increment_kg), duration_increment_s: num(v.duration_increment_s) },
    });
    if (!res.ok) return toast.error(res.message);
    toast.success("Progression settings saved");
    router.refresh();
  }

  async function reset() {
    await api(`/api/exercises/${props.exerciseId}/settings`, { method: "DELETE" });
    setV({ rep_min: "", rep_max: "", increment_kg: "", duration_increment_s: "" });
    router.refresh();
  }

  const input = (key: keyof typeof v, label: string, placeholder: number, step = "1") => (
    <div className="space-y-1">
      <Label htmlFor={`prog-${key}`} className="text-xs">{label}</Label>
      <Input id={`prog-${key}`} type="number" inputMode="decimal" step={step} placeholder={String(placeholder)} value={v[key]} onChange={(e) => setV({ ...v, [key]: e.target.value })} className="h-11" />
    </div>
  );

  return (
    <form onSubmit={save} className="space-y-3">
      <p className="text-muted-foreground text-sm">Leave blank to use the defaults shown.</p>
      <div className="grid grid-cols-2 gap-3">
        {isDuration ? (
          input("duration_increment_s", "Add per session (s)", props.defaults.durationIncrementS)
        ) : (
          <>
            {input("rep_min", "Rep range: min", props.defaults.repMin)}
            {input("rep_max", "Rep range: max", props.defaults.repMax)}
            {input("increment_kg", "Weight increment (kg)", props.defaults.incrementKg, "0.25")}
          </>
        )}
      </div>
      <div className="flex gap-2">
        <Button type="submit" className="h-11 flex-1">Save</Button>
        {props.settings && <Button type="button" variant="outline" className="h-11" onClick={reset}>Use defaults</Button>}
      </div>
    </form>
  );
}
