import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { SPORT_LABELS, formatDuration, formatLocalDateTime, formatPaceOrSpeed } from "@/lib/activities/format";
import { SPORTS } from "@/lib/ingest/payload";
import { formatDistance, type UnitSystem } from "@/lib/units";
import { cn } from "@/lib/utils";
import type { ActivityRow } from "@/server/activities/views";

export function SportFilter({ active }: { active: string | null }) {
  const options = [{ value: null, label: "All" }, ...SPORTS.map((s) => ({ value: s, label: SPORT_LABELS[s]! }))];
  return (
    <nav aria-label="Filter by sport" className="-mx-1 flex gap-1 overflow-x-auto px-1">
      {options.map((o) => (
        <Link
          key={o.label}
          href={o.value ? `/train/activities?sport=${o.value}` : "/train/activities"}
          aria-current={active === o.value ? "page" : undefined}
          className={cn(
            "flex min-h-9 items-center rounded-full border px-3 text-sm whitespace-nowrap",
            active === o.value ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground",
          )}
        >
          {o.label}
        </Link>
      ))}
    </nav>
  );
}

export function ActivityList(props: { activities: ActivityRow[]; timezone: string; units: UnitSystem }) {
  if (props.activities.length === 0) {
    return <p className="text-muted-foreground text-sm">No activities yet. Sync Apple Health or upload a FIT file.</p>;
  }
  return (
    <ul className="divide-y rounded-xl border" aria-label="Activities">
      {props.activities.map((a) => {
        const pace = formatPaceOrSpeed(a.sport, a.distance_m, a.moving_s ?? a.elapsed_s, props.units);
        const seconds = a.moving_s ?? a.elapsed_s;
        return (
          <li key={a.id}>
            <Link href={`/train/activities/${a.id}`} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="font-medium">
                  {SPORT_LABELS[a.sport] ?? a.sport}
                  {a.distance_m ? ` · ${formatDistance(a.distance_m, props.units)}` : ""}
                </p>
                <p className="text-muted-foreground text-sm">
                  <time dateTime={a.occurred_at}>{formatLocalDateTime(a.occurred_at, props.timezone)}</time>
                  {seconds ? ` · ${formatDuration(seconds)}` : ""}
                  {pace ? ` · ${pace}` : ""}
                  {a.avg_hr ? ` · ${a.avg_hr} bpm` : ""}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                {a.sources.map((s) => (
                  <Badge key={s} variant="secondary">{s === "fit" ? "FIT" : "Health"}</Badge>
                ))}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
