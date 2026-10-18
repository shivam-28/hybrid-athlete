import Link from "next/link";
import { Dumbbell, Footprints, Salad } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 px-6 pt-safe pb-safe">
      <div className="space-y-3">
        <h1 className="text-4xl font-bold tracking-tight">Hybrid Athlete</h1>
        <p className="text-muted-foreground text-lg">
          Lift, run and fuel in one place. Log sets by voice, snap your meals, sync your Garmin through Apple Health.
        </p>
      </div>
      <ul className="text-muted-foreground space-y-3">
        <li className="flex items-center gap-3"><Dumbbell className="size-5" /> Strength with progressive overload</li>
        <li className="flex items-center gap-3"><Footprints className="size-5" /> Running base toward your marathon</li>
        <li className="flex items-center gap-3"><Salad className="size-5" /> Calorie and macro targets that follow your training</li>
      </ul>
      <Button asChild size="lg">
        <Link href="/today">Get started</Link>
      </Button>
    </main>
  );
}
