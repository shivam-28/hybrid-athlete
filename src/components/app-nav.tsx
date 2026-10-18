"use client";

import Link from "next/link";
import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { Activity, Dumbbell, Salad, Settings, Sparkles, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

export const NAV_ITEMS = [
  { href: "/today", label: "Today", icon: Sun },
  { href: "/train", label: "Train", icon: Dumbbell },
  { href: "/eat", label: "Eat", icon: Salad },
  { href: "/body", label: "Body", icon: Activity },
  { href: "/coach", label: "Coach", icon: Sparkles },
] as const;

type IsActive = (href: string) => boolean;
const noneActive: IsActive = () => false;

// usePathname() is request data on dynamic routes; read it behind Suspense so the
// nav still renders (without a highlighted tab) in the static shell.
function WithActivePath({ render }: { render: (isActive: IsActive) => React.ReactNode }) {
  const pathname = usePathname();
  return render((href) => pathname === href || pathname.startsWith(`${href}/`));
}

function withActivePath(render: (isActive: IsActive) => React.ReactNode) {
  return (
    <Suspense fallback={render(noneActive)}>
      <WithActivePath render={render} />
    </Suspense>
  );
}

export function BottomTabBar() {
  return withActivePath((isActive) => <BottomTabBarView isActive={isActive} />);
}

export function SideNav() {
  return withActivePath((isActive) => <SideNavView isActive={isActive} />);
}

function BottomTabBarView({ isActive }: { isActive: IsActive }) {
  return (
    <nav
      aria-label="Primary"
      className="bg-background/95 supports-[backdrop-filter]:bg-background/80 fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur md:hidden"
    >
      <ul className="mb-safe grid grid-cols-5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs",
                isActive(href) ? "text-primary font-semibold" : "text-muted-foreground",
              )}
            >
              <Icon className="size-5" aria-hidden />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function SideNavView({ isActive }: { isActive: IsActive }) {
  return (
    <nav aria-label="Primary" className="hidden w-56 shrink-0 border-r p-4 md:flex md:flex-col md:gap-1">
      <p className="mb-4 px-3 text-lg font-bold">Hybrid Athlete</p>
      {[...NAV_ITEMS, { href: "/settings", label: "Settings", icon: Settings }].map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={isActive(href) ? "page" : undefined}
          className={cn(
            "flex min-h-11 items-center gap-3 rounded-md px-3",
            isActive(href) ? "bg-accent font-semibold" : "text-muted-foreground hover:bg-accent/50",
          )}
        >
          <Icon className="size-5" aria-hidden />
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function SettingsLink() {
  return (
    <Link href="/settings" aria-label="Settings" className="text-muted-foreground flex size-11 items-center justify-center md:hidden">
      <Settings className="size-5" />
    </Link>
  );
}
