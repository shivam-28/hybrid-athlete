"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { TargetsResult } from "@/lib/nutrition/targets";
import { WhyList } from "./why-list";

export function WhySheet({ result }: { result: Extract<TargetsResult, { ok: true }> }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="link" className="h-11 px-0">
          Why this number?
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Why this number</DialogTitle>
          <DialogDescription>Calculated from your profile, weight trend, body composition, goal and today&apos;s training. Not by AI.</DialogDescription>
        </DialogHeader>
        <WhyList result={result} />
      </DialogContent>
    </Dialog>
  );
}
