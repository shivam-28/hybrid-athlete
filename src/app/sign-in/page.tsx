import type { Metadata } from "next";
import { Suspense } from "react";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-6 pt-safe pb-safe">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="text-muted-foreground">We&apos;ll email you a 6-digit code. No password needed.</p>
      </div>
      <Suspense>
        <SignInForm />
      </Suspense>
    </main>
  );
}
