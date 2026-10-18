"use client";

import { useActionState, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Field } from "@/components/field";
import { deleteAccountAction } from "@/server/account-actions";

export function DeleteAccountDialog() {
  const [state, formAction, pending] = useActionState(deleteAccountAction, {});
  const [confirm, setConfirm] = useState("");

  return (
    <Dialog onOpenChange={() => setConfirm("")}>
      <DialogTrigger asChild>
        <Button variant="destructive" className="h-11 w-full">Delete account</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete your account?</DialogTitle>
          <DialogDescription>
            This permanently deletes your profile, workouts, meals, body data, photos and AI key. It cannot be undone.
            Download your data first if you want a copy.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <Field id="confirm" label="Type DELETE to confirm" errors={state.error ? [state.error] : undefined}>
            <Input id="confirm" name="confirm" autoComplete="off" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-11" />
          </Field>
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit" variant="destructive" disabled={pending || confirm !== "DELETE"}>
              Permanently delete
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
