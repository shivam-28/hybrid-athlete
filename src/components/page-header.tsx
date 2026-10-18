import type { ReactNode } from "react";
import { SettingsLink } from "@/components/app-nav";

export function PageHeader(props: { title: string; subtitle?: ReactNode }) {
  return (
    <header className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{props.title}</h1>
        {props.subtitle && <p className="text-muted-foreground">{props.subtitle}</p>}
      </div>
      <SettingsLink />
    </header>
  );
}
