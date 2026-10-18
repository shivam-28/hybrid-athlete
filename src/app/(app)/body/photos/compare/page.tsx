import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ComparePanel, CompareControls } from "@/components/body/photo-compare";
import { PageSkeleton } from "@/components/page-skeleton";
import type { UnitSystem } from "@/lib/units";
import { requireProfile } from "@/server/auth";
import { getAiKeyStatus } from "@/server/ai/keys";
import { comparePhotos, listPhotos } from "@/server/body/photos";

export const metadata: Metadata = { title: "Compare photos" };

export default function ComparePage(props: PageProps<"/body/photos/compare">) {
  return (
    <>
      <div>
        <Link href="/body/photos" className="text-muted-foreground text-sm">← Photos</Link>
        <h1 className="text-2xl font-semibold tracking-tight">Compare photos</h1>
      </div>
      <Suspense fallback={<PageSkeleton />}>
        <CompareContent searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function CompareContent({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const { supabase, profile, user } = await requireProfile("/body/photos/compare");
  const dates = [...new Set((await listPhotos(supabase)).map((p) => p.local_date))].sort();
  if (dates.length < 2) return <p className="text-muted-foreground text-sm">Add photos on at least two dates to compare them.</p>;

  const pick = (v: unknown, fallback: string) => (typeof v === "string" && dates.includes(v) ? v : fallback);
  const dateA = pick(q.a, dates[0]!);
  const dateB = pick(q.b, dates.at(-1)!);
  const pose = typeof q.pose === "string" && ["front", "side", "back"].includes(q.pose) ? q.pose : "front";
  const [cmp, key] = await Promise.all([comparePhotos(supabase, { dateA, dateB, pose }), getAiKeyStatus(user.id)]);

  return (
    <>
      <CompareControls dates={dates} dateA={dateA} dateB={dateB} pose={pose} />
      <ComparePanel
        a={cmp.a}
        b={cmp.b}
        daysApart={cmp.daysApart}
        units={profile.unit_system as UnitSystem}
        consented={!!profile.progress_photo_ai_consent_at}
        hasAiKey={!!key && !key.invalid}
      />
    </>
  );
}
