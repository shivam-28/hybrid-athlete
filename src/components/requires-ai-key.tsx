import Link from "next/link";
import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";

/** Renders an AI-only action, or an explanation with a link to Settings when the user has no usable key. */
export function RequiresAiKey(props: { available: boolean; feature: string; children: ReactNode }) {
  if (props.available) return props.children;
  return (
    <div className="text-muted-foreground flex items-start gap-3 rounded-md border border-dashed p-3 text-sm" aria-disabled="true">
      <Sparkles className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p>
        {props.feature} needs your Anthropic API key.{" "}
        <Link href="/settings#ai-key" className="text-foreground underline">
          Add it in Settings
        </Link>
        .
      </p>
    </div>
  );
}
