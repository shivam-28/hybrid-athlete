export function PageSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <div className="bg-muted h-24 animate-pulse rounded-xl" />
      <div className="bg-muted h-24 animate-pulse rounded-xl" />
    </div>
  );
}
