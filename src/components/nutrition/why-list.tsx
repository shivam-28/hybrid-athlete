import { formatKcal, formatSigned } from "@/lib/nutrition/format";
import type { TargetsResult } from "@/lib/nutrition/targets";

type Ok = Extract<TargetsResult, { ok: true }>;

const PHASE_LABELS = { cut: "Cut", lean_gain: "Lean gain", recomposition: "Recomposition", maintain: "Maintain" } as const;
const DAY_LABELS = { rest: "Rest/easy day", run: "Run day (≥ 60 min)", long_run: "Long-run day (≥ 90 min)" } as const;

/** Every component that sums to the target, plus the methods behind it. */
export function WhyList({ result }: { result: Ok }) {
  const { info, targets, components } = result;
  return (
    <div className="space-y-4 text-sm">
      <table className="w-full" aria-label="Calorie target breakdown">
        <tbody>
          {components.map((c, i) => (
            <tr key={c.key} className="border-b last:border-0" data-testid="why-component">
              <td className="py-1.5 pr-2">{c.label}</td>
              <td className="py-1.5 text-right tabular-nums">{i === 0 ? formatKcal(c.kcal) : formatSigned(c.kcal)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-semibold">
            <td className="pt-2">Target</td>
            <td className="pt-2 text-right tabular-nums" data-testid="why-total">
              {formatKcal(targets.kcal)}
            </td>
          </tr>
        </tfoot>
      </table>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
        <dt className="text-muted-foreground">BMR</dt>
        <dd>
          {formatKcal(info.bmr)} · {info.bmrMethod}
          {info.bmrNote && <span className="text-muted-foreground block">{info.bmrNote}</span>}
        </dd>
        <dt className="text-muted-foreground">Activity level</dt>
        <dd>{info.lifestyleLabel}</dd>
        <dt className="text-muted-foreground">Expenditure</dt>
        <dd>
          {info.expenditureLabel}
          {info.expenditureNote && <span className="text-muted-foreground block">{info.expenditureNote}</span>}
        </dd>
        <dt className="text-muted-foreground">Goal phase</dt>
        <dd>
          {PHASE_LABELS[info.phase]}
          {info.promptToSetGoal && (
            <a href="/body/goal" className="block underline">
              Set a goal to steer your target
            </a>
          )}
        </dd>
        <dt className="text-muted-foreground">Protein</dt>
        <dd>
          {info.proteinPerKg} g/kg × {info.refWeightKg} kg {info.refWeightIsGoal ? "(goal weight)" : ""} = {targets.protein_g} g
        </dd>
        <dt className="text-muted-foreground">Fat</dt>
        <dd>25% of calories, at least 0.6 g/kg = {targets.fat_g} g</dd>
        <dt className="text-muted-foreground">Carbs</dt>
        <dd>
          The rest = {targets.carb_g} g · {DAY_LABELS[info.dayClass]} floor {info.carbFloorGPerKg} g/kg
        </dd>
        <dt className="text-muted-foreground">Fiber</dt>
        <dd>14 g per 1000 kcal = {targets.fiber_g} g</dd>
      </dl>
    </div>
  );
}
