"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";

export function DeleteExerciseButton({ exerciseId }: { exerciseId: string }) {
  const router = useRouter();
  async function remove() {
    if (!window.confirm("Delete this custom exercise? If you've logged it before, it is archived and your history is kept.")) return;
    const res = await api<{ result: "archived" | "deleted" }>(`/api/exercises/${exerciseId}`, { method: "DELETE" });
    if (!res.ok) return toast.error(res.message);
    toast.success(res.data.result === "archived" ? "Exercise archived; your history is kept." : "Exercise deleted.");
    router.push("/train/exercises");
    router.refresh();
  }
  return (
    <Button variant="outline" className="h-11" onClick={remove}>
      Delete
    </Button>
  );
}
