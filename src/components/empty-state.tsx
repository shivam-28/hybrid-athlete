import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState(props: { icon: LucideIcon; title: string; children: ReactNode }) {
  const Icon = props.icon;
  return (
    <div className="flex items-start gap-4 rounded-xl border border-dashed p-4">
      <Icon className="text-muted-foreground mt-0.5 size-6 shrink-0" aria-hidden />
      <div className="space-y-1">
        <h2 className="font-medium">{props.title}</h2>
        <p className="text-muted-foreground text-sm">{props.children}</p>
      </div>
    </div>
  );
}
