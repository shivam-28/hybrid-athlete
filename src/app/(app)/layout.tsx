import { BottomTabBar, SideNav } from "@/components/app-nav";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh">
      <SideNav />
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 pt-safe pb-28 md:px-8 md:pb-8">{children}</main>
      <BottomTabBar />
    </div>
  );
}
