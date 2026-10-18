"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/field";
import { createClient } from "@/lib/supabase/client";
import { safeNextPath } from "@/lib/access";

// Supabase uses HTTP 403 for both wrong codes and hook rejections, so match on the message.
function friendlyError(message: string): string {
  if (/invite-only/i.test(message)) {
    return "This instance is invite-only. Ask the person who runs it to add your email.";
  }
  if (/expired|invalid/i.test(message)) return "That code is invalid or has expired. Try again or request a new one.";
  if (/security purposes|rate/i.test(message)) return "Please wait a moment before requesting another code.";
  return "Something went wrong. Please try again.";
}

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next"));
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(
    searchParams.get("error") === "link" ? "That sign-in link has expired or was already used. Request a new code." : null,
  );
  const [pending, setPending] = useState(false);

  async function sendCode(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/auth/confirm` },
    });
    setPending(false);
    if (error) setError(friendlyError(error.message));
    else setStep("code");
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const { error } = await createClient().auth.verifyOtp({ email, token: code.trim(), type: "email" });
    if (error) {
      setPending(false);
      setError(friendlyError(error.message));
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return step === "email" ? (
    <form onSubmit={sendCode} className="space-y-4">
      <Field id="email" label="Email">
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-11"
        />
      </Field>
      {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
      <Button type="submit" className="h-11 w-full" disabled={pending}>
        Send code
      </Button>
    </form>
  ) : (
    <form onSubmit={verifyCode} className="space-y-4">
      <p className="text-sm">
        Code sent to <strong>{email}</strong>. Check your inbox.
      </p>
      <Field id="code" label="6-digit code">
        <Input
          id="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="h-11 text-center text-2xl tracking-[0.5em]"
        />
      </Field>
      {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
      <Button type="submit" className="h-11 w-full" disabled={pending}>
        Sign in
      </Button>
      <Button type="button" variant="ghost" className="w-full" onClick={() => setStep("email")}>
        Use a different email
      </Button>
    </form>
  );
}
