import Link from "next/link";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { href: "/body", label: "Weight" },
  { href: "/body/measurements", label: "Measurements" },
  { href: "/body/composition", label: "Composition" },
  { href: "/body/photos", label: "Photos" },
  { href: "/body/goal", label: "Goal" },
] as const;

/** Section links for the Body tab; each page passes its own href so no client routing hook is needed. */
export function BodyNav({ active }: { active: (typeof SECTIONS)[number]["href"] }) {
  return (
    <nav aria-label="Body sections" className="-mx-4 overflow-x-auto px-4">
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
