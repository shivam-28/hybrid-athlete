import type { Metadata } from "next";
import { ProfileForm } from "@/components/profile-form";
import { requireUser } from "@/server/auth";
import { completeOnboarding } from "@/server/profile-actions";

export const metadata: Metadata = { title: "Welcome" };

export default async function OnboardingPage() {
  await requireUser("/onboarding");
  return (
    <main className="mx-auto w-full max-w-md space-y-6 px-6 pt-safe pb-safe">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Let&apos;s set you up</h1>
        <p className="text-muted-foreground">These details drive your calorie, heart-rate and training calculations.</p>
      </div>
      <ProfileForm action={completeOnboarding} submitLabel="Continue" />
    </main>
  );
}
