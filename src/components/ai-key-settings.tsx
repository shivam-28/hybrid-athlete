"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/field";
import { deleteAiKeyAction, saveAiKeyAction } from "@/server/ai-key-actions";
import type { AiKeyStatus } from "@/server/ai/keys";

export function AiKeySettings({ status }: { status: AiKeyStatus | null }) {
  const [state, formAction, pending] = useActionState(saveAiKeyAction, {});

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        AI features (voice parsing, meal photos, body-scan reading, weekly plans) run on your own Anthropic API key, so
        usage is billed to you. Create one at{" "}
        <a className="underline" href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
          console.anthropic.com
        </a>
        . It is stored encrypted and never shown again.
      </p>

      {status && (
        <div className="flex items-center justify-between gap-3 rounded-md border p-3">
          <div>
            <p className="font-mono">••••{status.last4}</p>
            <p className="text-muted-foreground text-xs">Added {new Date(status.addedAt).toLocaleDateString()}</p>
          </div>
          <form action={deleteAiKeyAction}>
            <Button type="submit" variant="outline" size="sm">Remove</Button>
          </form>
        </div>
      )}
      {status?.invalid && (
        <p role="alert" className="text-destructive text-sm">
          Anthropic no longer accepts this key. Add a new one to keep using AI features.
        </p>
      )}

      <form action={formAction} className="space-y-3">
        <Field id="api_key" label={status ? "Replace key" : "Anthropic API key"}>
          <Input id="api_key" name="api_key" type="password" autoComplete="off" placeholder="sk-ant-…" required className="h-11 font-mono" />
        </Field>
        {state.error && <p role="alert" className="text-destructive text-sm">{state.error}</p>}
        {state.message && <p role="status" className="text-sm text-green-600">{state.message}</p>}
        <Button type="submit" className="h-11 w-full" disabled={pending}>
          {pending ? "Checking with Anthropic…" : "Save key"}
        </Button>
      </form>
    </div>
  );
}
