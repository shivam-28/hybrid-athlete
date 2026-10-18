import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { Button } from "@/components/ui/button";
import { EatWorkspace } from "@/components/nutrition/eat-workspace";
import { MicrosTable } from "@/components/nutrition/micros-table";
import { TargetsCard } from "@/components/nutrition/targets-card";
import { addDays } from "@/lib/activities/dates";
import { formatShortDate } from "@/lib/activities/format";
import type { MissingInput } from "@/lib/nutrition/targets";
import { localDate } from "@/lib/time";
import { getAiKeyStatus } from "@/server/ai/keys";
import { requireProfile } from "@/server/auth";
import { loadDay } from "@/server/nutrition/day";

export const metadata: Metadata = { title: "Eat" };

const MISSING: Record<MissingInput, { label: string; href: string }> = {
  weight: { label: "your weight", href: "/body" },
  sex: { label: "your sex", href: "/settings" },
  birth_date: { label: "your date of birth", href: "/settings" },
  height: { label: "your height", href: "/settings" },
};

export default function EatPage(props: PageProps<"/eat">) {
  return (
    <>
      <PageHeader title="Eat" />
      <Suspense fallback={<PageSkeleton />}>
        <EatContent searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function EatContent({ searchParams }: { searchParams: PageProps<"/eat">["searchParams"] }) {
  const { profile, supabase, user } = await requireProfile("/eat");
  const today = localDate(new Date(), profile.timezone);
  const requested = (await searchParams).date;
  const date = typeof requested === "string" && /^\d{4}-\d{2}-\d{2}$/.test(requested) && requested <= today ? requested : today;
  const [day, aiKey] = await Promise.all([loadDay(supabase, profile, date), getAiKeyStatus(user.id)]);
  const result = day.targets.result;

  return (
    <div className="space-y-6">
      <nav aria-label="Day" className="flex items-center justify-between">
        <Button asChild variant="ghost" size="icon" className="size-11">
          <Link href={`/eat?date=${addDays(date, -1)}`} aria-label="Previous day">
            <ChevronLeft className="size-5" />
          </Link>
        </Button>
        <p className="font-medium" data-testid="eat-date">
          {date === today ? "Today" : formatShortDate(date)}
        </p>
        {date < today ? (
          <Button asChild variant="ghost" size="icon" className="size-11">
            <Link href={addDays(date, 1) === today ? "/eat" : `/eat?date=${addDays(date, 1)}`} aria-label="Next day">
              <ChevronRight className="size-5" />
            </Link>
          </Button>
        ) : (
          <span className="size-11" />
        )}
      </nav>

      {result.ok ? (
        <TargetsCard result={result} eaten={day.totals} />
      ) : (
        <section className="rounded-xl border border-dashed p-4 text-sm" aria-label="Targets need input">
          <p className="font-medium">Your targets need a few details first</p>
          <ul className="mt-2 list-disc pl-5">
            {result.missing.map((m) => (
              <li key={m}>
                Add{" "}
                <Link className="underline" href={MISSING[m].href}>
                  {MISSING[m].label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <EatWorkspace
        date={date}
        isToday={date === today}
        timezone={profile.timezone}
        hasAiKey={aiKey !== null && !aiKey.invalid}
        meals={day.meals}
        planned={date === today ? day.planned : []}
        isComplete={day.isComplete}
      />

      <details className="rounded-xl border p-4">
        <summary className="min-h-11 cursor-pointer font-medium">More nutrients</summary>
        <MicrosTable totals={day.totals} incomplete={day.incomplete} />
      </details>
    </div>
  );
}
