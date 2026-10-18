import { BASELINE_DAYS, type TrainingLoad } from "@/lib/activities/load";

export function TrainingLoadPanel({ load }: { load: TrainingLoad }) {
  return (
    <dl className="grid grid-cols-3 gap-3 text-center" aria-label="Training load">
      <div>
        <dt className="text-muted-foreground text-xs">Acute (7 d)</dt>
        <dd className="text-lg font-semibold">{Math.round(load.acute)}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground text-xs">Chronic (28 d ÷ 4)</dt>
        <dd className="text-lg font-semibold">{Math.round(load.chronic)}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground text-xs">Ratio</dt>
        <dd className="text-lg font-semibold">
          {load.ratio !== null ? load.ratio.toFixed(1) : <span className="text-muted-foreground text-sm font-normal">building baseline</span>}
        </dd>
      </div>
      {!load.baselineReady && (
        <p className="text-muted-foreground col-span-3 text-xs">
          The ratio appears once you have {BASELINE_DAYS} days of activity history.
        </p>
      )}
    </dl>
  );
}
