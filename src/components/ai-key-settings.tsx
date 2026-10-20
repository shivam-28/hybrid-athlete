"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/field";
import { NativeSelect } from "@/components/native-select";
import { deleteAiKeyAction, saveAiKeyAction } from "@/server/ai-key-actions";
import type { AiKeyStatus, AiProvider } from "@/server/ai/keys";

const PROVIDER_LABEL: Record<AiProvider, string> = { anthropic: "Anthropic", foundry: "Microsoft Foundry" };

export function AiKeySettings({ status, defaultModels }: { status: AiKeyStatus | null; defaultModels: { main: string; fast: string } }) {
  const [state, formAction, pending] = useActionState(saveAiKeyAction, {});
  const [provider, setProvider] = useState<AiProvider>(status?.provider ?? "anthropic");
  const foundry = provider === "foundry";

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        AI features (voice parsing, meal photos, body-scan reading, weekly plans) run on your own Claude access, so usage is
        billed to you. Use an Anthropic API key from{" "}
        <a className="underline" href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
          console.anthropic.com
        </a>{" "}
        or a Claude deployment in Microsoft Foundry. Keys are stored encrypted and never shown again.
      </p>

      {status && (
        <div className="flex items-center justify-between gap-3 rounded-md border p-3">
          <div>
            <p className="font-mono">••••{status.last4}</p>
            <p className="text-muted-foreground text-xs">
              {PROVIDER_LABEL[status.provider]}
              {status.endpointHost && ` · ${status.endpointHost}`} · added {new Date(status.addedAt).toLocaleDateString()}
            </p>
          </div>
          <form action={deleteAiKeyAction}>
            <Button type="submit" variant="outline" size="sm">Remove</Button>
          </form>
        </div>
      )}
      {status?.invalid && (
        <p role="alert" className="text-destructive text-sm">
          {PROVIDER_LABEL[status.provider]} no longer accepts this key. Add a new one to keep using AI features.
        </p>
      )}

      <form action={formAction} className="space-y-3">
        {status && <p className="text-sm font-medium">Replace your key</p>}
        <Field id="provider" label="Provider">
          <NativeSelect id="provider" name="provider" value={provider} onChange={(e) => setProvider(e.target.value as AiProvider)}>
            <option value="anthropic">Anthropic</option>
            <option value="foundry">Microsoft Foundry (Azure)</option>
          </NativeSelect>
        </Field>

        {foundry && (
          <>
            <p className="rounded-md border border-amber-500/50 p-3 text-sm" role="note">
              Foundry usage is billed to <strong>your own Azure subscription</strong>. Don&apos;t use an employer&apos;s
              subscription for this personal app. Requests go to your Foundry resource, not to Anthropic.
            </p>
            <Field id="endpoint" label="Foundry endpoint" hint="Azure portal → your Foundry resource → Keys and Endpoint (the …/anthropic URL).">
              <Input id="endpoint" name="endpoint" type="url" inputMode="url" autoComplete="off" required placeholder="https://your-resource.services.ai.azure.com/anthropic" className="h-11 font-mono" />
            </Field>
          </>
        )}

        <Field id="api_key" label={foundry ? "Foundry API key" : "Anthropic API key"}>
          <Input id="api_key" name="api_key" type="password" autoComplete="off" placeholder={foundry ? "Key 1 or Key 2" : "sk-ant-…"} required className="h-11 font-mono" />
        </Field>

        {foundry && (
          <details className="text-sm">
            <summary className="cursor-pointer py-2">Custom deployment names (optional)</summary>
            <div className="space-y-3 pt-2">
              <Field id="main_deployment" label="Main model deployment" hint="Reads photos and documents, writes plans.">
                <Input id="main_deployment" name="main_deployment" autoComplete="off" placeholder={defaultModels.main} className="h-11 font-mono" />
              </Field>
              <Field id="fast_deployment" label="Fast model deployment" hint="Parses spoken workout logs.">
                <Input id="fast_deployment" name="fast_deployment" autoComplete="off" placeholder={defaultModels.fast} className="h-11 font-mono" />
              </Field>
            </div>
          </details>
        )}

        {state.error && <p role="alert" className="text-destructive text-sm">{state.error}</p>}
        {state.message && <p role="status" className="text-sm text-green-600">{state.message}</p>}
        <Button type="submit" className="h-11 w-full" disabled={pending}>
          {pending ? `Checking with ${PROVIDER_LABEL[provider]}…` : "Save key"}
        </Button>
      </form>
    </div>
  );
}
