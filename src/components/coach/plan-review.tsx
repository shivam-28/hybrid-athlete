"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api-client";
import { addDays } from "@/lib/activities/dates";
import { DAY_SHORT, exerciseLine, formatWeekRange, sessionSummary, sessionTitle } from "@/lib/coach/format";
import { RULE_TITLES, validatePlan, type GuardrailContext, type Violation } from "@/lib/coach/guardrails";
import { PHASE_INFO, type TrainingPhase } from "@/lib/coach/phase";
import { sessionDetails } from "@/lib/coach/plan-rows";
import type { PlanSession, WeekPlan } from "@/lib/coach/plan-schema";
import { cn } from "@/lib/utils";
import { GeneratePlanButton } from "./generate-plan-button";
import { SessionEditor } from "./session-editor";

export type ReviewSession = { id: string; day_index: number; status: string; details: PlanSession };

function toWeekPlan(sessions: ReviewSession[]): WeekPlan {
  const days: WeekPlan["days"] = Array.from({ length: 7 }, () => ({ sessions: [] }));
  for (const s of sessions) days[s.day_index]!.sessions.push({ ...s.details, id: s.id });
  return { days };
}

export function PlanReview(props: {
  planId: string;
  status: "draft" | "active" | "superseded";
  weekStart: string;
  phase: TrainingPhase;
  sessions: ReviewSession[];
  guardrails: GuardrailContext;
  aiAvailable: boolean;
}) {
  const router = useRouter();
  const [sessions, setSessions] = useState(props.sessions);
  const [editing, setEditing] = useState<ReviewSession | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const editable = props.status !== "superseded";

  // Same validator as the server: warnings appear the moment an edit is made.
  const warnings = useMemo(() => validatePlan(toWeekPlan(sessions), props.guardrails), [sessions, props.guardrails]);
  const bySession = (id: string) => warnings.filter((w) => w.sessionIds.includes(id));
  const byDay = (day: number) => warnings.filter((w) => w.sessionIds.length === 0 && w.dayIndexes.includes(day));
  const weekLevel = warnings.filter((w) => w.sessionIds.length === 0 && w.dayIndexes.length === 0);

  async function save(session: PlanSession, dayIndex: number) {
    const previous = sessions;
    setSessions((list) => list.map((s) => (s.id === session.id ? { ...s, day_index: dayIndex, details: session } : s)));
    setEditing(null);
    setAcknowledged(false);
    const result = await api(`/api/coach/sessions/${session.id}`, { method: "PATCH", body: { details: sessionDetails(session), day_index: dayIndex } });
    if (!result.ok) {
      setSessions(previous);
      setError(result.message);
    }
  }

  async function remove(id: string) {
    const previous = sessions;
    setSessions((list) => list.filter((s) => s.id !== id));
    setAcknowledged(false);
    const result = await api(`/api/coach/sessions/${id}`, { method: "DELETE" });
    if (!result.ok) {
      setSessions(previous);
      setError(result.message);
    }
  }

  async function accept() {
    setPending(true);
    setError(null);
    const result = await api(`/api/coach/plan/${props.planId}/accept`, { body: { acknowledged } });
    setPending(false);
    if (!result.ok) return setError(result.message);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={props.status === "active" ? "default" : "secondary"}>{props.status === "active" ? "Active plan" : props.status === "draft" ? "Draft" : "Superseded"}</Badge>
        <Badge variant="outline">{PHASE_INFO[props.phase].label} phase</Badge>
        <span className="text-muted-foreground text-sm">{formatWeekRange(props.weekStart)}</span>
      </div>

      {warnings.length > 0 && (
        <Card className="border-amber-500/60" role="region" aria-label="Plan warnings">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-5 text-amber-500" aria-hidden /> {warnings.length} safety warning{warnings.length === 1 ? "" : "s"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <ul className="space-y-2 text-sm" aria-label="Warnings">
              {warnings.map((w, i) => (
                <li key={`${w.rule}-${i}`}>
                  <strong>{RULE_TITLES[w.rule]}:</strong> {w.message}
                </li>
              ))}
            </ul>
            {weekLevel.length > 0 && <p className="text-muted-foreground text-xs">Edit sessions or regenerate to resolve them.</p>}
          </CardContent>
        </Card>
      )}

      <ol className="space-y-3" aria-label="Week plan">
        {DAY_SHORT.map((day, dayIndex) => {
          const daySessions = sessions.filter((s) => s.day_index === dayIndex);
          const dayWarnings = byDay(dayIndex);
          return (
            <li key={day}>
              <Card className={cn(dayWarnings.length > 0 && "border-amber-500/60")}>
                <CardContent className="space-y-3">
                  <h3 className="text-sm font-semibold">
                    {day} <span className="text-muted-foreground font-normal">{addDays(props.weekStart, dayIndex).slice(5)}</span>
                  </h3>
                  {daySessions.length === 0 && <p className="text-muted-foreground text-sm">Rest day</p>}
                  {daySessions.map((s) => (
                    <SessionCard key={s.id} session={s} warnings={bySession(s.id)} editable={editable} onEdit={() => setEditing(s)} onDelete={() => remove(s.id)} />
                  ))}
                  {dayWarnings.map((w, i) => (
                    <p key={i} className="text-sm text-amber-600 dark:text-amber-400">⚠ {w.message}</p>
                  ))}
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ol>

      {error && <p role="alert" className="text-destructive text-sm">{error}</p>}

      {props.status === "draft" && (
        <Card>
          <CardContent className="space-y-3">
            {warnings.length > 0 && (
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" className="mt-0.5 size-5" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} />
                I&apos;ve read the warnings and want to use this plan anyway.
              </label>
            )}
            <Button type="button" className="h-11 w-full" onClick={accept} disabled={pending || (warnings.length > 0 && !acknowledged)}>
              Accept plan
            </Button>
            {props.aiAvailable && <GeneratePlanButton weekStart={props.weekStart} label="Regenerate" variant="outline" />}
          </CardContent>
        </Card>
      )}
      {props.status === "active" && props.aiAvailable && <GeneratePlanButton weekStart={props.weekStart} label="Generate a new version" variant="outline" />}

      {editing && (
        <SessionEditor
          key={editing.id}
          session={{ ...editing.details, id: editing.id }}
          dayIndex={editing.day_index}
          open
          onOpenChange={(open) => !open && setEditing(null)}
          onSave={save}
        />
      )}
    </div>
  );
}

function SessionCard(props: { session: ReviewSession; warnings: Violation[]; editable: boolean; onEdit: () => void; onDelete: () => void }) {
  const s = props.session.details;
  return (
    <div className={cn("space-y-1 rounded-md border p-3", props.warnings.length > 0 && "border-amber-500/70 bg-amber-500/5")} data-testid="planned-session">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium">
            {sessionTitle(s)}{" "}
            {props.session.status !== "planned" && <Badge variant="secondary">{props.session.status === "completed" ? "Done" : "Skipped"}</Badge>}
          </p>
          <p className="text-muted-foreground text-sm">{sessionSummary(s)}</p>
        </div>
        {props.editable && (
          <div className="flex shrink-0">
            <Button type="button" variant="ghost" size="icon" className="size-11" aria-label={`Edit ${sessionTitle(s)}`} onClick={props.onEdit}>
              <Pencil className="size-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="size-11" aria-label={`Delete ${sessionTitle(s)}`} onClick={props.onDelete}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        )}
      </div>
      {(s.type === "strength" || s.type === "core") && s.exercises.length > 0 && (
        <ul className="text-muted-foreground text-sm">
          {s.exercises.map((e, i) => (
            <li key={i}>{exerciseLine(e)}</li>
          ))}
        </ul>
      )}
      {"notes" in s && s.notes && <p className="text-muted-foreground text-xs">{s.notes}</p>}
      {props.warnings.map((w, i) => (
        <p key={i} className="text-sm text-amber-600 dark:text-amber-400" role="note">
          ⚠ {RULE_TITLES[w.rule]}: {w.message}
        </p>
      ))}
    </div>
  );
}
