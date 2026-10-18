"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { MEAL_TYPE_LABELS } from "@/lib/nutrition/draft";
import type { RecommendResult, RecommendedOption } from "@/server/nutrition/recommend";

const r = (n: number) => Math.round(n);

/** "What should I eat for the rest of today?" — options are verified server-side and labelled as estimates. */
export function Recommendations() {
  const router = useRouter();
  const [result, setResult] = useState<RecommendResult | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function request(mode: "rest_of_day" | "light_snack") {
    setPending(true);
    setError(null);
    const res = await api<RecommendResult>("/api/nutrition/recommendations", { body: { mode } });
    setPending(false);
    if (res.ok) setResult(res.data);
    else setError(res.message);
  }

  async function plan(option: RecommendedOption) {
    const res = await api("/api/planned-meals", { body: option });
    if (!res.ok) return toast.error(res.message);
    toast.success("Planned for today");
    setResult(null);
    router.refresh();
  }

  return (
    <section aria-label="Meal suggestions" className="space-y-3 rounded-xl border p-4">
      <Button type="button" variant="secondary" className="h-11 w-full" onClick={() => request("rest_of_day")} disabled={pending}>
        <Sparkles className="size-4" aria-hidden />
        {pending ? "Thinking…" : "What should I eat for the rest of today?"}
      </Button>
      {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
      {result?.kind === "target_met" && (
        <div className="space-y-2 text-sm">
          <p>You&apos;ve already reached today&apos;s calorie target.</p>
          <Button type="button" variant="outline" className="h-11" onClick={() => request("light_snack")} disabled={pending}>
            Suggest a light high-protein snack
          </Button>
        </div>
      )}
      {result?.kind === "none" && <p className="text-sm">No suggestions fitted your remaining targets and preferences right now. Try again later or log what you eat.</p>}
      {result?.kind === "options" && (
        <>
          <p className="text-muted-foreground text-xs">
            Amounts are estimates recalculated from food databases. Always check ingredients if you have allergies.
          </p>
          <ul className="space-y-3" aria-label="Suggested options">
            {result.options.map((option, i) => (
              <li key={i} className="space-y-2 rounded-md border p-3" data-testid="suggestion">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{option.title}</p>
                    <p className="text-muted-foreground text-xs tabular-nums">
                      ≈ {r(option.totals.kcal)} kcal · P {r(option.totals.protein_g)} g · C {r(option.totals.carb_g)} g · F {r(option.totals.fat_g)} g
                    </p>
                  </div>
                  <Button type="button" size="sm" className="h-11 shrink-0" onClick={() => plan(option)}>
                    Plan this
                  </Button>
                </div>
                {option.meals.map((meal, j) => (
                  <div key={j} className="text-sm">
                    <p>
                      <span className="text-muted-foreground">{MEAL_TYPE_LABELS[meal.slot]}:</span> {meal.name}{" "}
                      <span className="text-muted-foreground text-xs">(≈ {r(meal.totals.kcal)} kcal, {r(meal.totals.protein_g)} g protein)</span>
                    </p>
                    <p className="text-muted-foreground text-xs">{meal.foods.map((f) => `${f.name} ${f.grams} g`).join(" · ")}</p>
                  </div>
                ))}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
