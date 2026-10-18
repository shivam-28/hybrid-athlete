"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/field";
import { ClientImageError, reencodeForUpload } from "@/lib/images/normalize-client";
import { cn } from "@/lib/utils";

const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
const POSES = ["front", "side", "back"] as const;

export function PhotoUpload({ today }: { today: string }) {
  const router = useRouter();
  const [pose, setPose] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    setError(null);
    const file = new FormData(formEl).get("photo");
    if (!pose) return setError("Choose a pose: front, side or back.");
    if (!(file instanceof File) || file.size === 0) return setError("Choose a photo to upload.");
    setBusy(true);
    try {
      const form = new FormData(formEl);
      form.delete("photo");
      form.set("file", await reencodeForUpload(file, MAX_PHOTO_BYTES));
      form.set("pose", pose);
      const res = await fetch("/api/progress-photos", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(data.message ?? "The photo couldn't be uploaded.");
      formEl.reset();
      router.refresh();
    } catch (e) {
      setError(e instanceof ClientImageError ? e.message : "The photo couldn't be uploaded.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Pose</legend>
        <div role="radiogroup" className="grid grid-cols-3 gap-2">
          {POSES.map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={pose === p}
              onClick={() => setPose(p)}
              className={cn("min-h-11 rounded-md border capitalize", pose === p && "bg-primary text-primary-foreground border-primary")}
            >
              {p}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <Field id="photo-date" label="Date">
          <Input id="photo-date" name="date" type="date" defaultValue={today} max={today} className="h-11" />
        </Field>
        <Field id="photo-file" label="Photo">
          <Input id="photo-file" name="photo" type="file" accept="image/*" className="h-11" />
        </Field>
      </div>
      {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
      <Button type="submit" className="h-11 w-full" disabled={busy}>{busy ? "Uploading…" : "Save photo"}</Button>
      <p className="text-muted-foreground text-xs">Location and camera details are removed on your phone before upload. Only you can see your photos.</p>
    </form>
  );
}
