"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";

export function ReopenSessionButton({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  async function reopen() {
    const res = await api(`/api/workouts/sessions/${sessionId}/reopen`, { method: "POST" });
    if (!res.ok) return toast.error(res.error === "active_session_exists" ? "Finish your current workout before reopening this one." : res.message);
    router.push("/train");
  }
  return (
    <Button variant="outline" className="h-11" onClick={reopen}>
      Reopen to add sets
    </Button>
  );
}
