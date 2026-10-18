"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api-client";
import { SCORE_LABELS, exerciseLine, sessionSummary, sessionTitle } from "@/lib/coach/format";
import type { PlanSession } from "@/lib/coach/plan-schema";
import type { ReadinessScore, Signal } from "@/lib/coach/readiness";
import { cn } from "@/lib/utils";

export type TodayCoachData = {
  checkin: { sleep_quality: number; soreness: number; energy: number; stress: number; pain_flag: boolean; pain_note: string | null; adjustment_choice: string } | null;
  readiness: { score: ReadinessScore; reasons: string[]; notes: string[]; referral: string | null; signals: Signal[] } | null;
  sessions: {
    session: { id: string; status: string; auto_completed: boolean; adjusted_details: unknown; workout_session_id: string | null; activity_id: string | null };
    original: PlanSession;
    proposed: PlanSession | null;
  }[];
};

const QUESTIONS = [
  { name: "sleep_quality", label: "Sleep quality", low: "poor", high: "great" },
  { name: "soreness", label: "Muscle soreness", low: "very sore", high: "none" },
  { name: "energy", label: "Energy", low: "drained", high: "high" },
  { name: "stress", label: "Stress", low: "very stressed", high: "calm" },
] as const;

const SCORE_STYLES: Record<ReadinessScore, string> = {
  green: "border-green-500 text-green-700 dark:text-green-400",
  amber: "border-amber-500 text-amber-700 dark:text-amber-400",
  red: "border-red-500 text-red-700 dark:text-red-400",
};
const NO_PLAN_GUIDANCE: Record<ReadinessScore, string> = {
  green: "You're good to train as you planned.",
  amber: "Keep today's training easy: aerobic running, lighter lifting, stop well short of failure.",
  red: "Make today a recovery day: rest, gentle mobility or an easy walk.",
};

export function TodayCoachCard({ data }: { data: TodayCoachData }) {
  const router = useRouter();
  const [editing, setEditing] = useState(data.checkin === null);
  const [pain, setPain] = useState(data.checkin?.pain_flag ?? false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function run(path: string, body: unknown) {
    setPending(true);
    setError(null);
    const result = await api(path, { body });
    setPending(false);
    if (!result.ok) {
      setError(result.message);
      return false;
    }
    router.refresh();
    return true;
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget));
    if (await run("/api/coach/checkin", { ...form, pain_flag: pain })) setEditing(false);
  }

  const readiness = data.readiness;
  const choice = data.checkin?.adjustment_choice ?? "none";
  const hasProposal = data.sessions.some((s) => s.proposed && s.session.status === "planned");

  return (
    <Card aria-label="Readiness and today's training">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span>Readiness</span>
          {readiness && !editing && (
            <Badge variant="outline" className={cn("text-sm", SCORE_STYLES[readiness.score])} data-testid="readiness-score">
              {readiness.score.toUpperCase()} · {SCORE_LABELS[readiness.score]}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {editing ? (
          <form onSubmit={submit} className="space-y-4" aria-label="Daily check-in">
            {QUESTIONS.map((q) => (
              <fieldset key={q.name} className="space-y-1.5">
                <legend className="text-sm font-medium">
                  {q.label} <span className="text-muted-foreground font-normal">(1 {q.low} – 5 {q.high})</span>
                </legend>
                <div className="grid grid-cols-5 gap-2">
                  {[1, 2, 3, 4, 5].map((v) => (
                    <label key={v} className="has-[:checked]:bg-primary has-[:checked]:text-primary-foreground flex min-h-11 cursor-pointer items-center justify-center rounded-md border text-sm font-medium">
                      <input type="radio" name={q.name} value={v} required className="sr-only" defaultChecked={data.checkin?.[q.name] === v} aria-label={`${q.label} ${v}`} />
                      {v}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
            <label className="flex items-center gap-3 text-sm">
              <input type="checkbox" className="size-5" checked={pain} onChange={(e) => setPain(e.target.checked)} />
              I have pain or an injury
            </label>
            {pain && <Textarea name="pain_note" aria-label="Where does it hurt? (optional)" placeholder="Where does it hurt? (optional)" defaultValue={data.checkin?.pain_note ?? ""} maxLength={500} />}
            <Button type="submit" className="h-11 w-full" disabled={pending}>
              Check in
            </Button>
          </form>
        ) : (
          readiness && (
            <div className="space-y-2">
              {readiness.referral && (
                <p role="alert" className="rounded-md border border-red-500/50 bg-red-500/5 p-3 text-sm">
                  {readiness.referral}
                </p>
              )}
              <ul className="space-y-1 text-sm" aria-label="Readiness reasons">
                {readiness.reasons.map((r) => (
                  <li key={r}>• {r}</li>
                ))}
                {readiness.notes.map((n) => (
                  <li key={n} className="text-muted-foreground">• {n}</li>
                ))}
              </ul>
              <p className="text-muted-foreground text-xs">
                {readiness.signals.filter((s) => s.status === "unavailable").map((s) => s.label).join(", ") || "All signals"}
                {readiness.signals.some((s) => s.status === "unavailable") ? " unavailable (needs Apple Health data)." : " checked."}
              </p>
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
                Redo check-in
              </Button>
            </div>
          )
        )}

        {data.sessions.length === 0 ? (
          readiness ? (
            <p className="text-sm">
              {NO_PLAN_GUIDANCE[readiness.score]}{" "}
              <Link href="/coach" className="text-muted-foreground underline">Plan your week</Link>
            </p>
          ) : (
            <p className="text-muted-foreground text-sm">
              No plan for today. <Link href="/coach" className="underline">Get a weekly plan</Link> balancing lifting and running.
            </p>
          )
        ) : (
          <section className="space-y-3" aria-label="Today's planned training">
            <h3 className="text-sm font-semibold">Today&apos;s plan</h3>
            {data.sessions.map(({ session, original, proposed }) => {
              const adjusted = session.adjusted_details as PlanSession | null;
              const active = adjusted ?? original;
              return (
                <div key={session.id} className="space-y-2 rounded-md border p-3" data-testid="today-session">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        {sessionTitle(active)}{" "}
                        {session.status !== "planned" && <Badge variant="secondary">{session.status === "completed" ? "Done" : "Skipped"}</Badge>}
                      </p>
                      <p className="text-muted-foreground text-sm">{sessionSummary(active)}</p>
                      {adjusted && <p className="text-muted-foreground text-xs line-through">Planned: {sessionSummary(original)}</p>}
                      {(active.type === "strength" || active.type === "core") && active.exercises.length > 0 && (
                        <ul className="text-muted-foreground mt-1 text-xs">
                          {active.exercises.map((e, i) => (
                            <li key={i}>{exerciseLine(e)}</li>
                          ))}
                        </ul>
                      )}
                      {session.auto_completed && (
                        <p className="text-muted-foreground text-xs">Completed automatically from your {session.activity_id ? "synced run" : "logged workout"}.</p>
                      )}
                    </div>
                  </div>
                  {proposed && session.status === "planned" && choice === "none" && (
                    <p className="rounded-md bg-amber-500/10 p-2 text-sm">
                      Suggested: <strong>{sessionTitle(proposed)}</strong> · {sessionSummary(proposed)}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {session.status === "planned" ? (
                      <>
                        <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => run(`/api/coach/sessions/${session.id}/status`, { status: "completed" })}>
                          Mark done
                        </Button>
                        <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => run(`/api/coach/sessions/${session.id}/status`, { status: "skipped" })}>
                          Skip
                        </Button>
                      </>
                    ) : (
                      <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => run(`/api/coach/sessions/${session.id}/status`, { status: "planned" })}>
                        Undo
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
            {hasProposal && choice === "none" && (
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" className="h-11" disabled={pending} onClick={() => run("/api/coach/readiness/adjustment", { choice: "accepted" })}>
                  Use suggestion
                </Button>
                <Button type="button" variant="outline" className="h-11" disabled={pending} onClick={() => run("/api/coach/readiness/adjustment", { choice: "overridden" })}>
                  Keep original
                </Button>
              </div>
            )}
            {choice === "overridden" && <p className="text-muted-foreground text-xs">You kept the original plan for today.</p>}
          </section>
        )}
        {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
      </CardContent>
    </Card>
  );
}
