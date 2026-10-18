import type { UnitSystem } from "@/lib/units";
import type { Suggestion } from "@/lib/workouts/progression";
import { describeSuggestion } from "@/lib/workouts/suggestion-text";

/** Read-only: shows last time and today's target. It never fills in or saves a set. */
export function SuggestionPanel(props: {
  previous: { localDate: string; summary: string } | null;
  suggestion: Suggestion;
  units: UnitSystem;
}) {
  const { label, text } = describeSuggestion(props.suggestion, props.units);
  return (
    <div className="bg-muted/50 space-y-1 rounded-md p-3 text-sm" data-testid="suggestion">
      {props.previous ? (
        <p>
          <span className="text-muted-foreground">Last time ({props.previous.localDate}):</span> {props.previous.summary}
        </p>
      ) : (
        <p className="text-muted-foreground">No previous sessions for this exercise.</p>
      )}
      <p>
        <span className="font-medium">{label}:</span> {text}
      </p>
    </div>
  );
}
