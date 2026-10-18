import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { requireProfile } from "@/server/auth";
import { listSessions } from "@/server/workouts/views";

export const metadata: Metadata = { title: "Workout history" };

export default function HistoryPage() {
  return (
    <>
      <PageHeader title="Workout history" />
      <Suspense fallback={<PageSkeleton />}>
        <SessionList />
      </Suspense>
    </>
  );
}

async function SessionList() {
  const { supabase } = await requireProfile("/train/history");
  const sessions = await listSessions(supabase);
  if (sessions.length === 0) return <p className="text-muted-foreground text-sm">No workouts logged yet.</p>;
  return (
    <ul className="divide-y rounded-md border" aria-label="Sessions">
      {sessions.map((s) => (
        <li key={s.id}>
          <Link href={`/train/history/${s.id}`} className="hover:bg-accent flex min-h-14 flex-col justify-center px-3 py-2">
            <span className="font-medium">
              {s.local_date}
              {!s.finished_at && <span className="text-primary text-xs"> · in progress</span>}
            </span>
            <span className="text-muted-foreground text-xs">
              {s.durationMinutes} min · {s.exerciseCount} exercise{s.exerciseCount === 1 ? "" : "s"} · {s.workingSets} working set
              {s.workingSets === 1 ? "" : "s"}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
