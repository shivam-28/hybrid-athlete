"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api-client";
import type { FoodCandidate } from "@/lib/nutrition/draft";
import { SOURCE_LABELS } from "@/lib/nutrition/format";

/** Manual search across USDA and Open Food Facts. No AI key needed. */
export function FoodSearch({ onAdd }: { onAdd: (candidate: FoodCandidate, grams: number) => void }) {
  const [query, setQuery] = useState("");
  const [grams, setGrams] = useState("100");
  const [results, setResults] = useState<FoodCandidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function search(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const res = await api<{ results: FoodCandidate[] }>(`/api/foods/search?q=${encodeURIComponent(query)}`);
    setPending(false);
    if (res.ok) setResults(res.data.results);
    else setError(res.message);
  }

  const gramsValue = Number(grams);
  return (
    <div className="space-y-3">
      <form onSubmit={search} className="flex gap-2" role="search">
        <Input aria-label="Search foods" placeholder="e.g. skyr, oats, banana" value={query} onChange={(e) => setQuery(e.target.value)} minLength={2} required className="h-11" />
        <Button type="submit" className="h-11" disabled={pending}>
          Search
        </Button>
      </form>
      <label className="flex items-center gap-2 text-sm">
        Grams
        <Input aria-label="Grams to add" type="number" inputMode="decimal" min={1} max={5000} value={grams} onChange={(e) => setGrams(e.target.value)} className="h-11 w-28" />
      </label>
      {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
      {results?.length === 0 && <p className="text-muted-foreground text-sm">No foods found. Try a simpler name.</p>}
      {results && results.length > 0 && (
        <ul className="divide-y rounded-md border" aria-label="Search results">
          {results.map((c) => (
            <li key={`${c.source}:${c.ref}`} className="flex items-center justify-between gap-2 p-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{c.name}</p>
                <p className="text-muted-foreground text-xs">
                  {SOURCE_LABELS[c.source]} · {Math.round(c.per100g.kcal ?? 0)} kcal / 100 g
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-11 shrink-0"
                disabled={!(gramsValue > 0 && gramsValue <= 5000)}
                onClick={() => onAdd(c, gramsValue)}
                aria-label={`Add ${c.name}`}
              >
                Add
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
