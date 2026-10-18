"use client";

import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";

export function AliasList({ aliases }: { aliases: { id: string; phrase: string; exerciseName: string }[] }) {
  const router = useRouter();
  if (aliases.length === 0) {
    return <p className="text-muted-foreground text-sm">When you confirm what a spoken phrase meant, it&apos;s remembered here.</p>;
  }
  async function remove(id: string) {
    const res = await api(`/api/workouts/aliases/${id}`, { method: "DELETE" });
    if (!res.ok) return toast.error(res.message);
    router.refresh();
  }
  return (
    <ul className="divide-y rounded-md border" aria-label="Voice aliases">
      {aliases.map((a) => (
        <li key={a.id} className="flex min-h-11 items-center gap-2 px-3 text-sm">
          <span className="flex-1">
            “{a.phrase}” → <strong>{a.exerciseName}</strong>
          </span>
          <Button variant="ghost" size="icon" aria-label={`Delete alias ${a.phrase}`} onClick={() => remove(a.id)}>
            <X />
          </Button>
        </li>
      ))}
    </ul>
  );
}
