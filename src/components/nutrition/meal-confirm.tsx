"use client";

import { useReducer, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/native-select";
import { api } from "@/lib/api-client";
import { MEAL_TYPES, MEAL_TYPE_LABELS, draftTotals, itemNutrients, type MealDraft, type MealType } from "@/lib/nutrition/draft";
import { candidateKey, draftEditor } from "@/lib/nutrition/draft-editor";
import { SOURCE_LABELS } from "@/lib/nutrition/format";
import { cn } from "@/lib/utils";
import { FoodSearch } from "./food-search";

export type ConfirmMode = { kind: "new" } | { kind: "edit"; mealId: string };

const round = (n: number | null) => Math.round(n ?? 0);

export function MealConfirm(props: { initial: MealDraft; mode: ConfirmMode; defaultMealType: MealType; onDone: (saved: boolean) => void }) {
  const [draft, dispatch] = useReducer(draftEditor, props.initial);
  const [mealType, setMealType] = useState<MealType>(props.defaultMealType);
  const [showSearch, setShowSearch] = useState(props.initial.items.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const { totals } = draftTotals(draft.items);
  const estimatedFromAi = draft.source === "photo" || draft.source === "text";

  async function save() {
    setPending(true);
    setError(null);
    const body = { ...draft, meal_type: mealType };
    const res =
      props.mode.kind === "edit"
        ? await api(`/api/meals/${props.mode.mealId}`, { method: "PATCH", body: { meal_type: mealType, name: draft.name, items: draft.items } })
        : await api("/api/meals", { body });
    setPending(false);
    if (res.ok) props.onDone(true);
    else setError(res.message);
  }

  return (
    <section aria-label="Confirm meal" className="space-y-4 rounded-xl border p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{props.mode.kind === "edit" ? "Edit meal" : "Confirm meal"}</h2>
        <NativeSelect aria-label="Meal type" value={mealType} onChange={(e) => setMealType(e.target.value as MealType)} className="w-36">
          {MEAL_TYPES.map((t) => (
            <option key={t} value={t}>
              {MEAL_TYPE_LABELS[t]}
            </option>
          ))}
        </NativeSelect>
      </div>
      {estimatedFromAi && (
        <p className="rounded-md bg-amber-50 p-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          Photo and description estimates can be off by 20–30%. Correcting the grams makes your totals much more accurate.
        </p>
      )}

      <ul className="space-y-3" aria-label="Meal items">
        {draft.items.map((item, index) => {
          const n = itemNutrients(item);
          return (
            <li key={index} className={cn("space-y-2 rounded-md border p-3", item.confidence === "low" && "border-amber-500 bg-amber-50/50 dark:bg-amber-950/30")} data-testid="draft-item">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{item.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {SOURCE_LABELS[item.nutrient_source]}
                    {item.matched_name && item.nutrient_source !== "estimated" ? ` · ${item.matched_name}` : ""}
                    {item.preparation ? ` · ${item.preparation}` : ""}
                    {item.confidence ? ` · ${item.confidence} confidence` : ""}
                  </p>
                  {item.confidence === "low" && <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Please check this item</p>}
                </div>
                <Button type="button" variant="ghost" size="icon" className="size-11 shrink-0" aria-label={`Remove ${item.name}`} onClick={() => dispatch({ type: "remove", index })}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={5}
                  max={Math.max(600, item.grams * 2)}
                  step={5}
                  value={item.grams}
                  onChange={(e) => dispatch({ type: "grams", index, grams: Number(e.target.value) })}
                  aria-label={`${item.name} grams slider`}
                  className="flex-1"
                />
                <Input
                  type="number"
                  inputMode="decimal"
                  min={1}
                  max={5000}
                  value={item.grams}
                  onChange={(e) => dispatch({ type: "grams", index, grams: Number(e.target.value) })}
                  aria-label={`${item.name} grams`}
                  className="h-11 w-24"
                />
                <span className="text-sm">g</span>
              </div>
              {(item.alternatives.length > 1 || (item.estimate && item.nutrient_source !== "estimated")) && (
                <NativeSelect
                  aria-label={`${item.name} food match`}
                  value={item.nutrient_source === "estimated" ? "estimated" : `${item.nutrient_source}:${item.source_ref}`}
                  onChange={(e) => dispatch({ type: "swap", index, ref: e.target.value })}
                >
                  {item.alternatives.map((c) => (
                    <option key={candidateKey(c)} value={candidateKey(c)}>
                      {c.name} ({SOURCE_LABELS[c.source]})
                    </option>
                  ))}
                  {item.estimate && <option value="estimated">AI estimate</option>}
                </NativeSelect>
              )}
              <p className="text-muted-foreground text-xs tabular-nums" data-testid="item-nutrients">
                {round(n.kcal)} kcal · P {round(n.protein_g)} g · C {round(n.carb_g)} g · F {round(n.fat_g)} g
              </p>
            </li>
          );
        })}
      </ul>

      {showSearch ? (
        <FoodSearch
          onAdd={(candidate, grams) => {
            dispatch({ type: "add", candidate, grams });
            setShowSearch(false);
          }}
        />
      ) : (
        <Button type="button" variant="outline" className="h-11 w-full" onClick={() => setShowSearch(true)}>
          Add an item
        </Button>
      )}

      <p className="font-medium tabular-nums" data-testid="draft-totals">
        Total: {round(totals.kcal)} kcal · P {round(totals.protein_g)} g · C {round(totals.carb_g)} g · F {round(totals.fat_g)} g
      </p>
      {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="h-11 flex-1" onClick={() => props.onDone(false)}>
          Cancel
        </Button>
        <Button type="button" className="h-11 flex-1" disabled={pending || draft.items.length === 0} onClick={save}>
          {props.mode.kind === "edit" ? "Save changes" : "Save meal"}
        </Button>
      </div>
    </section>
  );
}
