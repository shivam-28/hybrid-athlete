"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { deleteActivityAction } from "@/server/activity-actions";

export function DeleteActivityButton({ activityId }: { activityId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-11 w-full">Delete activity</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this activity?</DialogTitle>
          <DialogDescription>
            It disappears from your history, weekly totals and training load, and its stored FIT file is deleted. If the
            Shortcut sends it again it will come back from Apple Health.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button type="button" variant="outline">Cancel</Button>
          </DialogClose>
          <Button type="button" variant="destructive" disabled={pending} onClick={() => startTransition(() => deleteActivityAction(activityId))}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
