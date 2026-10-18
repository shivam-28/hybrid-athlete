export function PhotoAnalysisResult(props: { observations: string[]; visualImpression: string | null }) {
  return (
    <div className="space-y-2 text-sm">
      <ul className="list-disc space-y-1 pl-5">
        {props.observations.map((o) => (
          <li key={o}>{o}</li>
        ))}
      </ul>
      {props.visualImpression && (
        <p className="text-muted-foreground rounded-md border border-dashed p-2">
          <span className="font-medium">Visual impression, not a measurement:</span> {props.visualImpression}
        </p>
      )}
    </div>
  );
}
