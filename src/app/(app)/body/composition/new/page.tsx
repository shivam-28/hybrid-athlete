import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CompositionWizard } from "@/components/body/composition-wizard";
import { PageSkeleton } from "@/components/page-skeleton";
import { RequiresAiKey } from "@/components/requires-ai-key";
import { localDate } from "@/lib/time";
import type { UnitSystem } from "@/lib/units";
import { requireProfile } from "@/server/auth";
import { getAiKeyStatus } from "@/server/ai/keys";

export const metadata: Metadata = { title: "Add body composition test" };

export default function NewCompositionPage() {
  return (
    <>
      <div>
        <Link href="/body/composition" className="text-muted-foreground text-sm">← Composition</Link>
        <h1 className="text-2xl font-semibold tracking-tight">Add a test</h1>
      </div>
      <Suspense fallback={<PageSkeleton />}>
        <NewContent />
      </Suspense>
    </>
  );
}

async function NewContent() {
  const { profile, user } = await requireProfile("/body/composition/new");
  const key = await getAiKeyStatus(user.id);
  const hasAiKey = !!key && !key.invalid;
  return (
    <>
      <RequiresAiKey available={hasAiKey} feature="Reading values from a report automatically">
        <p className="text-muted-foreground text-sm">
          Upload a photo or PDF of your report and Claude reads the values for you to check. Nothing is saved until you confirm.
        </p>
      </RequiresAiKey>
      <CompositionWizard units={profile.unit_system as UnitSystem} today={localDate(new Date(), profile.timezone)} hasAiKey={hasAiKey} />
    </>
  );
}
