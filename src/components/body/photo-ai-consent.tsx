import { Button } from "@/components/ui/button";
import { setPhotoAiConsentAction } from "@/server/body-actions";

/** The explicit opt-in screen for progress-photo analysis (off by default). */
export function PhotoAiConsent({ consentedAt }: { consentedAt: string | null }) {
  return (
    <div className="space-y-3 text-sm">
      <p>
        AI photo analysis compares two of your progress photos and describes visible changes. When you request an analysis,{" "}
        <strong>both photos are sent to your AI provider (Anthropic, or Microsoft Foundry if you chose it) using your own key</strong>. Anthropic does not train on API inputs by default; on Foundry, your Azure subscription&apos;s data terms apply.
        Nothing is sent unless you ask for an analysis.
      </p>
      <p className="text-muted-foreground">It never measures body fat. Any rough range it mentions is labelled as a visual impression.</p>
      {consentedAt ? (
        <form action={setPhotoAiConsentAction.bind(null, false)} className="space-y-2">
          <p role="status">Turned on {new Date(consentedAt).toLocaleDateString()}.</p>
          <Button type="submit" variant="outline" className="h-11 w-full">Turn off AI photo analysis</Button>
        </form>
      ) : (
        <form action={setPhotoAiConsentAction.bind(null, true)}>
          <Button type="submit" className="h-11 w-full">I agree, turn on AI photo analysis</Button>
        </form>
      )}
    </div>
  );
}
