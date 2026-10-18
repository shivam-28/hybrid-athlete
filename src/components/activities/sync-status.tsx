import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import type { LastSync } from "@/server/ingest/tokens";

export const STALE_AFTER_HOURS = 36;

export function SyncStatus(props: { lastSync: LastSync; timezone: string; now: Date }) {
  if (!props.lastSync) {
    return (
      <p className="text-muted-foreground text-sm">
        Never synced.{" "}
        <Link href="/settings/apple-health" className="text-foreground underline">
          Set up the Apple Health Shortcut
        </Link>
      </p>
    );
  }
  const { at, counts } = props.lastSync;
  const when = new Intl.DateTimeFormat("en-GB", {
    timeZone: props.timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(at));
  const stale = props.now.getTime() - Date.parse(at) > STALE_AFTER_HOURS * 3_600_000;
  return (
    <div className="space-y-2 text-sm">
      <p>
        Last sync: <time dateTime={at}>{when}</time>
        <span className="text-muted-foreground">
          {" "}
          · {counts.inserted} new, {counts.updated} updated, {counts.unchanged} unchanged
        </span>
      </p>
      {stale && (
        <p role="alert" className="flex items-start gap-2 text-amber-600 dark:text-amber-500">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          No sync for over {STALE_AFTER_HOURS} hours. Check that the Shortcut automation is set to run immediately.
        </p>
      )}
    </div>
  );
}
