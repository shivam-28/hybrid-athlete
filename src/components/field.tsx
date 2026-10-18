import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";

export function Field(props: { id: string; label: string; hint?: string; errors?: string[]; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={props.id}>{props.label}</Label>
      {props.children}
      {props.hint && <p className="text-muted-foreground text-sm">{props.hint}</p>}
      {props.errors?.map((e) => (
        <p key={e} className="text-destructive text-sm" id={`${props.id}-error`}>
          {e}
        </p>
      ))}
    </div>
  );
}
