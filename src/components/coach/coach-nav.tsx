import Link from "next/link";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { href: "/coach", label: "Plan" },
  { href: "/coach/review", label: "Weekly review" },
  { href: "/coach/history", label: "History" },
  { href: "/coach/preferences", label: "Preferences" },
] as const;

/** Section links for the Coach tab; each page passes its own href. */
export function CoachNav({ active }: { active: (typeof SECTIONS)[number]["href"] }) {
  return (
    <nav aria-label="Coach sections" className="-mx-4 overflow-x-auto px-4">
      <ul className="flex gap-2">
        {SECTIONS.map(({ href, label }) => (
          <li key={href}>
            <Link
              href={href}
              aria-current={href === active ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center rounded-full border px-4 text-sm whitespace-nowrap",
                href === active ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground",
              )}
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
