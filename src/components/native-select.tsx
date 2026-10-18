import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Native <select> styled like shadcn inputs: best picker UX on iOS and accessible by default. */
export function NativeSelect({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "border-input bg-transparent dark:bg-input/30 h-11 w-full rounded-md border px-3 text-base shadow-xs outline-none",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}
