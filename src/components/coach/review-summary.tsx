"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";

export function ReviewSummary({ weekStart }: { weekStart: string }) {
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function load() {
    setPending(true);
    setError(null);
    const result = await api<{ summary: string }>("/api/coach/review/summary", { body: { week_start: weekStart } });
    setPending(false);
    if (result.ok) setSummary(result.data.summary);
    else setError(result.message);
  }

  return (
    <div className="space-y-3">
      {summary && <p className="text-sm leading-relaxed">{summary}</p>}
      {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
      <Button type="button" variant="outline" className="h-11 w-full" onClick={load} disabled={pending}>
        {pending ? "Writing your summary…" : summary ? "Rewrite summary" : "Get coach summary"}
      </Button>
    </div>
  );
}
