import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/page-skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileForm } from "@/components/profile-form";
import { AiKeySettings } from "@/components/ai-key-settings";
import { DeleteAccountDialog } from "@/components/delete-account-dialog";
import { getAiKeyStatus } from "@/server/ai/keys";
import { AliasList } from "@/components/workouts/alias-list";
import { PhotoAiConsent } from "@/components/body/photo-ai-consent";
import { PreferencesForm } from "@/components/nutrition/preferences-form";
import type { NutritionPreferences } from "@/lib/nutrition/preferences";
import { IngestTokenSettings } from "@/components/activities/ingest-token-settings";
import { SyncStatus } from "@/components/activities/sync-status";
import { getIngestTokenStatus, getLastSync } from "@/server/ingest/tokens";
import { listAliases } from "@/server/workouts/settings";
import { requireProfile } from "@/server/auth";
import { updateProfile } from "@/server/profile-actions";
import { signOut } from "@/server/session-actions";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <Suspense fallback={<PageSkeleton />}>
        <SettingsContent />
      </Suspense>
    </>
  );
}

async function SettingsContent() {
  const { profile, user, supabase } = await requireProfile("/settings");
  const [aiKey, aliases, ingestToken, lastSync] = await Promise.all([
    getAiKeyStatus(user.id),
    listAliases(supabase),
    getIngestTokenStatus(user.id),
    getLastSync(user.id),
  ]);
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm
            action={updateProfile}
            submitLabel="Save profile"
            showMaxHr
            defaults={{ ...profile, height_cm: Number(profile.height_cm), unit_system: profile.unit_system as "metric" | "imperial" }}
          />
        </CardContent>
      </Card>
      <Card id="nutrition">
        <CardHeader>
          <CardTitle>Nutrition preferences</CardTitle>
        </CardHeader>
        <CardContent>
          <PreferencesForm
            defaults={{
              lifestyle_level: profile.lifestyle_level as NutritionPreferences["lifestyle_level"],
              diet_type: profile.diet_type as NutritionPreferences["diet_type"],
              allergies: profile.allergies,
              dislikes: profile.dislikes,
              cuisines: profile.cuisines,
            }}
          />
        </CardContent>
      </Card>
      <Card id="ai-key">
        <CardHeader>
          <CardTitle>AI key</CardTitle>
        </CardHeader>
        <CardContent>
          <AiKeySettings status={aiKey} />
        </CardContent>
      </Card>
      <Card id="apple-health">
        <CardHeader>
          <CardTitle>Apple Health sync</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Garmin Connect writes your workouts, steps, heart rate and sleep to Apple Health. A daily iPhone Shortcut sends
            them here using a personal ingest token.
          </p>
          <SyncStatus lastSync={lastSync} timezone={profile.timezone} now={new Date()} />
          <IngestTokenSettings status={ingestToken} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Voice aliases</CardTitle>
        </CardHeader>
        <CardContent>
          <AliasList aliases={aliases} />
        </CardContent>
      </Card>
      <Card id="photo-ai">
        <CardHeader>
          <CardTitle>AI photo analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <PhotoAiConsent consentedAt={profile.progress_photo_ai_consent_at} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Your data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-muted-foreground text-sm">
            Download everything you have stored as a JSON file, or permanently delete your account.
          </p>
          <Button asChild variant="outline" className="h-11 w-full">
            <a href="/api/account/export" download>Download my data</a>
          </Button>
          <DeleteAccountDialog />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-muted-foreground text-sm">Signed in as {user.email}</p>
          <form action={signOut}>
            <Button type="submit" variant="outline" className="h-11 w-full">
              Sign out
            </Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
