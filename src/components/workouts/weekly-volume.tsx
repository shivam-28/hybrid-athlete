import { MUSCLE_LABELS, type MuscleGroup } from "@/lib/workouts/types";

/** Working sets per muscle group this week (primary 1, secondary 0.5). */
export function WeeklyVolume({ rows }: { rows: { muscle_group: MuscleGroup; sets: number }[] }) {
  if (rows.length === 0) return <p className="text-muted-foreground text-sm">No working sets logged this week yet.</p>;
  const max = Math.max(...rows.map((r) => r.sets));
  return (
    <ul className="space-y-2" aria-label="Weekly sets per muscle group">
      {rows.map((r) => (
        <li key={r.muscle_group} className="grid grid-cols-[6rem_1fr_3rem] items-center gap-2 text-sm">
          <span>{MUSCLE_LABELS[r.muscle_group]}</span>
          <span className="bg-muted h-2 overflow-hidden rounded-full">
            <span className="bg-primary block h-full rounded-full" style={{ width: `${(r.sets / max) * 100}%` }} />
          </span>
          <span className="text-right tabular-nums">{Number(r.sets)}</span>
        </li>
      ))}
    </ul>
  );
}
