import { formatAmount } from "@/lib/nutrition/format";
import { NUTRIENT_LABELS, type NutrientKey } from "@/lib/nutrition/nutrients";

const OTHER: NutrientKey[] = ["sugar_g", "satfat_g", "sodium_mg", "potassium_mg", "calcium_mg", "iron_mg", "magnesium_mg", "vitamin_d_ug", "b12_ug"];

/** Totals of the other stored nutrients; "incomplete" when any item's source lacked the value. */
export function MicrosTable({ totals, incomplete }: { totals: Record<NutrientKey, number>; incomplete: readonly NutrientKey[] }) {
  return (
    <table className="w-full text-sm" aria-label="Other nutrients">
      <tbody>
        {OTHER.map((key) => (
          <tr key={key} className="border-b last:border-0">
            <td className="py-1.5">{NUTRIENT_LABELS[key].label}</td>
            <td className="py-1.5 text-right tabular-nums">
              {formatAmount(key, totals[key])}
              {incomplete.includes(key) && (
                <span className="text-muted-foreground ml-1 text-xs" title="Some foods today have no data for this nutrient">
                  (incomplete)
                </span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
