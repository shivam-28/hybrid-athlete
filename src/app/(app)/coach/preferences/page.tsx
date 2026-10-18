import type { Metadata } from "next";
import { Suspense } from "react";
import { CoachNav } from "@/components/coach/coach-nav";
import { TrainingPreferencesForm } from "@/components/coach/preferences-form";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/page-skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { requireProfile } from "@/server/auth";
import { getPreferences } from "@/server/coach/preferences";

export const metadata: Metadata = { title: "Training preferences" };

export default function CoachPreferencesPage() {
  return (
    <>
      <PageHeader title="Coach" />
      <CoachNav active="/coach/preferences" />
      <Suspense fallback={<PageSkeleton />}>
        <PreferencesContent />
      </Suspense>
    </>
  );
}

async function PreferencesContent() {
  const { supabase } = await requireProfile("/coach/preferences");
  const preferences = await getPreferences(supabase);
  return (
    <Card>
      <CardContent>
        <TrainingPreferencesForm defaults={preferences} />
      </CardContent>
    </Card>
  );
}
