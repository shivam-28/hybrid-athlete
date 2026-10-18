"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";

export function GeneratePlanButton({ weekStart, label = "Generate plan", variant = "default" }: { weekStart: string; label?: string; variant?: "default" | "outline" }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);

  async function generate() {
    setPending(true);
    setError(null);
    const result = await api<{ planId: string }>("/api/coach/plan", { body: { week_start: weekStart } });
    setPending(false);
    if (!result.ok) return setError({ code: result.error, message: result.message });
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant={variant} className="h-11 w-full" onClick={generate} disabled={pending}>
        {pending ? "Your coach is writing the week… (up to a minute)" : label}
      </Button>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error.message}{" "}
          {error.code === "missing_ai_key" || error.code === "ai_key_invalid" ? (
            <Link href="/settings#ai-key" className="underline">Open Settings</Link>
          ) : error.code === "no_preferences" ? (
            <Link href="/coach/preferences" className="underline">Set preferences</Link>
          ) : (
            <button type="button" className="underline" onClick={generate}>Try again</button>
          )}
        </p>
      )}
    </div>
  );
}
