import type { DraftItem, FoodCandidate, MealDraft } from "./draft";

export type DraftAction =
  | { type: "grams"; index: number; grams: number }
  | { type: "swap"; index: number; ref: string }
  | { type: "remove"; index: number }
  | { type: "add"; candidate: FoodCandidate; grams: number }
  | { type: "name"; name: string };

const candidateKey = (c: FoodCandidate) => `${c.source}:${c.ref}`;

/** Pure state transitions for the confirmation screen; totals are always derived from items. */
export function draftEditor(draft: MealDraft, action: DraftAction): MealDraft {
  const update = (index: number, fn: (item: DraftItem) => DraftItem) => ({
    ...draft,
    items: draft.items.map((item, i) => (i === index ? fn(item) : item)),
  });
  switch (action.type) {
    case "grams":
      if (!Number.isFinite(action.grams) || action.grams <= 0 || action.grams > 5000) return draft;
      return update(action.index, (item) => ({ ...item, grams: Math.round(action.grams), quantity_source: "user" }));
    case "swap":
      return update(action.index, (item) => {
        if (action.ref === "estimated") {
          return item.estimate ? { ...item, nutrient_source: "estimated", source_ref: null, matched_name: null, per100g: item.estimate } : item;
        }
        const chosen = item.alternatives.find((c) => candidateKey(c) === action.ref);
        return chosen ? { ...item, nutrient_source: chosen.source, source_ref: chosen.ref, matched_name: chosen.name, per100g: chosen.per100g } : item;
      });
    case "remove":
      return { ...draft, items: draft.items.filter((_, i) => i !== action.index) };
    case "add":
      return {
        ...draft,
        items: [
          ...draft.items,
          {
            name: action.candidate.name,
            grams: Math.round(action.grams),
            preparation: null,
            confidence: null,
            quantity_source: "user",
            nutrient_source: action.candidate.source,
            source_ref: action.candidate.ref,
            matched_name: action.candidate.name,
            per100g: action.candidate.per100g,
            estimate: null,
            alternatives: [action.candidate],
          },
        ],
      };
    case "name":
      return { ...draft, name: action.name };
  }
}

export { candidateKey };
