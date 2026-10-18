"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";

export function DeleteTestButton({ id, hasReport }: { id: string; hasReport: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="ghost"
      className="text-destructive h-11 w-full"
      disabled={busy}
      onClick={async () => {
        if (!confirm(hasReport ? "Delete this test and its uploaded report?" : "Delete this test?")) return;
        setBusy(true);
        await api(`/api/body-composition/tests/${id}`, { method: "DELETE" });
        router.push("/body/composition");
        router.refresh();
      }}
    >
      Delete test
    </Button>
  );
}
