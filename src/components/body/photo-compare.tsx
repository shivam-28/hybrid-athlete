"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/field";
import { NativeSelect } from "@/components/native-select";
import { api } from "@/lib/api-client";
import { displayWeight, formatDay, weightUnit } from "@/lib/body/format";
import type { UnitSystem } from "@/lib/units";
import { PhotoAnalysisResult } from "./photo-analysis-result";

type Side = { photo: { id: string; url: string; local_date: string; width: number; height: number }; weightKg: number | null } | null;

export function CompareControls(props: { dates: string[]; dateA: string; dateB: string; pose: string }) {
  const router = useRouter();
  const go = (next: Partial<{ a: string; b: string; pose: string }>) => {
    const q = new URLSearchParams({ a: props.dateA, b: props.dateB, pose: props.pose, ...next });
    router.replace(`/body/photos/compare?${q}`);
  };
  return (
    <div className="grid grid-cols-3 gap-2">
      <Field id="cmp-a" label="Earlier">
        <NativeSelect id="cmp-a" value={props.dateA} onChange={(e) => go({ a: e.target.value })}>
          {props.dates.map((d) => <option key={d} value={d}>{formatDay(d)}</option>)}
        </NativeSelect>
      </Field>
      <Field id="cmp-b" label="Later">
        <NativeSelect id="cmp-b" value={props.dateB} onChange={(e) => go({ b: e.target.value })}>
          {props.dates.map((d) => <option key={d} value={d}>{formatDay(d)}</option>)}
        </NativeSelect>
      </Field>
      <Field id="cmp-pose" label="Pose">
        <NativeSelect id="cmp-pose" value={props.pose} onChange={(e) => go({ pose: e.target.value })}>
          <option value="front">Front</option>
          <option value="side">Side</option>
          <option value="back">Back</option>
        </NativeSelect>
      </Field>
    </div>
  );
}

export function ComparePanel(props: { a: Side; b: Side; daysApart: number; units: UnitSystem; consented: boolean; hasAiKey: boolean }) {
  const [result, setResult] = useState<{ observations: string[]; visualImpression: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const side = (s: Side, label: string) =>
    s ? (
      <figure className="space-y-1">
        {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
        <img src={s.photo.url} alt={`${label}: ${formatDay(s.photo.local_date)}`} width={s.photo.width} height={s.photo.height} className="aspect-[3/4] w-full rounded-md object-cover" />
        <figcaption className="text-sm">
          <span className="font-medium">{formatDay(s.photo.local_date)}</span>
          {s.weightKg !== null && <span className="text-muted-foreground"> · {displayWeight(s.weightKg, props.units)} {weightUnit(props.units)}</span>}
        </figcaption>
      </figure>
    ) : (
      <p className="text-muted-foreground rounded-md border border-dashed p-4 text-sm">No photo with this pose on that date.</p>
    );

  async function analyze() {
    if (!props.a || !props.b) return;
    setBusy(true);
    setError(null);
    const res = await api<{ observations: string[]; visualImpression: string | null }>("/api/progress-photos/analyze", {
      body: { photoAId: props.a.photo.id, photoBId: props.b.photo.id },
    });
    setBusy(false);
    if (res.ok) setResult(res.data);
    else setError(res.message);
  }

  return (
    <div className="space-y-4">
      <p className="text-center font-medium" data-testid="days-apart">{props.daysApart} days apart</p>
      <div className="grid grid-cols-2 gap-3">
        {side(props.a, "Earlier")}
        {side(props.b, "Later")}
      </div>
      {props.a && props.b && (
        <div className="space-y-3 rounded-xl border p-3">
          <h2 className="font-medium">AI comparison</h2>
          {!props.consented ? (
            <p className="text-sm">
              AI photo analysis is off. <Link href="/settings#photo-ai" className="underline">Turn it on in Settings</Link> to have Claude describe visible changes.
            </p>
          ) : !props.hasAiKey ? (
            <p className="text-sm">
              Photo analysis needs your Anthropic API key. <Link href="/settings#ai-key" className="underline">Add it in Settings</Link>.
            </p>
          ) : (
            <Button className="h-11 w-full" onClick={analyze} disabled={busy}>{busy ? "Comparing…" : "Describe what changed"}</Button>
          )}
          {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
          {result && <PhotoAnalysisResult observations={result.observations} visualImpression={result.visualImpression} />}
        </div>
      )}
    </div>
  );
}
