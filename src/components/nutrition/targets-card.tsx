import { remainingOrOver } from "@/lib/nutrition/day-totals";
import { formatKcal } from "@/lib/nutrition/format";
import type { TargetsResult } from "@/lib/nutrition/targets";
import { cn } from "@/lib/utils";
import { WhySheet } from "./why-sheet";

type Ok = Extract<TargetsResult, { ok: true }>;
type Eaten = { kcal: number; protein_g: number; carb_g: number; fat_g: number; fiber_g: number };

const MACROS = [
  { key: "protein_g", label: "Protein" },
  { key: "carb_g", label: "Carbs" },
  { key: "fat_g", label: "Fat" },
  { key: "fiber_g", label: "Fiber" },
] as const;

function Bar({ value, target, label }: { value: number; target: number; label: string }) {
  const pct = target > 0 ? Math.min(100, (value / target) * 100) : 0;
  return (
    <div className="bg-muted h-2 w-full overflow-hidden rounded-full" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={Math.round(target)} aria-valuenow={Math.round(value)}>
      <div className={cn("h-full rounded-full", value > target ? "bg-amber-500" : "bg-primary")} style={{ width: `${pct}%` }} />
    </div>
  );
}

function Remaining({ target, eaten, unit }: { target: number; eaten: number; unit: string }) {
  const r = remainingOrOver(target, eaten);
  return (
    <span className={cn("text-sm", r.kind === "over" ? "font-medium text-amber-600" : "text-muted-foreground")} data-testid={`left-${unit}`}>
      {r.amount.toLocaleString("en-GB")} {unit} {r.kind === "over" ? "over" : "left"}
    </span>
  );
}

/** Totals vs targets with remaining (or a positive "over") per macro. */
export function TargetsCard({ result, eaten }: { result: Ok; eaten: Eaten }) {
  const { targets } = result;
  return (
    <section aria-label="Today's targets" className="space-y-4 rounded-xl border p-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-muted-foreground text-sm">Calories</p>
          <p className="text-2xl font-semibold" data-testid="kcal-eaten">
            {Math.round(eaten.kcal).toLocaleString("en-GB")} <span className="text-muted-foreground text-base font-normal">/ {formatKcal(targets.kcal)}</span>
          </p>
        </div>
        <div className="text-right">
          <Remaining target={targets.kcal} eaten={eaten.kcal} unit="kcal" />
        </div>
      </div>
      <Bar value={eaten.kcal} target={targets.kcal} label="Calories eaten" />
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        {MACROS.map(({ key, label }) => (
          <div key={key} className="space-y-1">
            <dt className="text-muted-foreground text-xs">{label}</dt>
            <dd className="text-sm font-medium">
              {Math.round(eaten[key])} / {targets[key]} g
            </dd>
            <Bar value={eaten[key]} target={targets[key]} label={`${label} eaten`} />
            <Remaining target={targets[key]} eaten={eaten[key]} unit="g" />
          </div>
        ))}
      </dl>
      {result.warnings.length > 0 && (
        <ul className="space-y-1 text-sm text-amber-700 dark:text-amber-400">
          {result.warnings.map((w) => (
            <li key={w.code}>⚠ {w.message}</li>
          ))}
        </ul>
      )}
      <WhySheet result={result} />
    </section>
  );
}
