import Link from "next/link";
import { Camera, Salad } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { remainingOrOver } from "@/lib/nutrition/day-totals";
import type { Targets } from "@/lib/nutrition/targets";

type Eaten = { kcal: number; protein_g: number; carb_g: number; fat_g: number };

/** Today: kcal + macro progress with a quick "snap meal" action. */
export function NutritionTodayCard({ targets, eaten }: { targets: Targets; eaten: Eaten }) {
  const kcal = remainingOrOver(targets.kcal, eaten.kcal);
  const macros = [
    ["P", eaten.protein_g, targets.protein_g],
    ["C", eaten.carb_g, targets.carb_g],
    ["F", eaten.fat_g, targets.fat_g],
  ] as const;
  return (
    <Card aria-label="Today's nutrition">
      <CardContent className="space-y-3">
        <Link href="/eat" className="flex items-start gap-4">
          <Salad className="text-primary mt-0.5 size-6 shrink-0" aria-hidden />
          <div className="flex-1">
            <h2 className="font-medium" data-testid="today-kcal">
              {Math.round(eaten.kcal).toLocaleString("en-GB")} / {targets.kcal.toLocaleString("en-GB")} kcal
            </h2>
            <p className="text-muted-foreground text-sm">
              {kcal.amount.toLocaleString("en-GB")} kcal {kcal.kind === "over" ? "over" : "left"} ·{" "}
              {macros.map(([label, value, target]) => `${label} ${Math.round(value)}/${target} g`).join(" · ")}
            </p>
            <div className="bg-muted mt-2 h-2 overflow-hidden rounded-full" role="progressbar" aria-label="Calories eaten" aria-valuemin={0} aria-valuemax={targets.kcal} aria-valuenow={Math.round(eaten.kcal)}>
              <div className="bg-primary h-full rounded-full" style={{ width: `${Math.min(100, (eaten.kcal / targets.kcal) * 100)}%` }} />
            </div>
          </div>
        </Link>
        <Button asChild variant="outline" className="h-11 w-full">
          <Link href="/eat">
            <Camera className="size-4" aria-hidden /> Snap meal
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
