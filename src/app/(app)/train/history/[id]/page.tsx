import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReopenSessionButton } from "@/components/workouts/reopen-session-button";
import type { UnitSystem } from "@/lib/units";
import { formatSetValues } from "@/lib/workouts/history";
import { requireProfile } from "@/server/auth";
import { sessionDurationMinutes, sessionView } from "@/server/workouts/views";

export const metadata: Metadata = { title: "Workout" };

export default function SessionPage({ params }: PageProps<"/train/history/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SessionDetail params={params} />
    </Suspense>
  );
}

async function SessionDetail({ params }: Pick<PageProps<"/train/history/[id]">, "params">) {
  const { id } = await params;
  const { supabase, profile } = await requireProfile(`/train/history/${id}`);
  const view = await sessionView(supabase, id);
  if (!view) notFound();
  const units = profile.unit_system as UnitSystem;
  return (
    <>
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Workout · {view.session.local_date}</h1>
        <p className="text-muted-foreground text-sm">
          {sessionDurationMinutes(view.session)} min{view.session.finished_at ? "" : " · in progress"}
        </p>
        {view.session.finished_at && <ReopenSessionButton sessionId={id} />}
      </header>
      {view.blocks.map((b) => (
        <Card key={b.exercise.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              <Link href={`/train/exercises/${b.exercise.id}`} className="hover:underline">{b.exercise.name}</Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2 text-sm">
              {b.sets.map((s) => (
                <li key={s.id}>
                  <span className="text-muted-foreground">Set {s.set_number}:</span> {formatSetValues(s, units, b.exercise.tracking_mode)}
                  {s.rpe !== null && <span className="text-muted-foreground"> @ RPE {s.rpe}</span>}
                  {s.set_type !== "working" && <span className="text-muted-foreground"> · {s.set_type}</span>}
                  {s.transcript && <p className="text-muted-foreground text-xs">Heard ({s.source}): “{s.transcript}”</p>}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      ))}
    </>
  );
}
