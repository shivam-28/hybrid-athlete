"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

type UploadState = { kind: "idle" } | { kind: "uploading"; name: string } | { kind: "error"; message: string; duplicateId?: string };

/** Upload a .fit file or the .zip from Garmin Connect "Export Original". */
export function FitUpload() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>({ kind: "idle" });

  async function upload(file: File) {
    setState({ kind: "uploading", name: file.name });
    const body = new FormData();
    body.append("file", file);
    try {
      const res = await fetch("/api/activities/upload", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        router.push(`/train/activities/${data.activity_id}`);
        return;
      }
      setState({ kind: "error", message: data.message ?? "Upload failed.", duplicateId: data.error === "duplicate" ? data.activity_id : undefined });
    } catch {
      setState({ kind: "error", message: "Upload failed. Check your connection and try again." });
    } finally {
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={input}
        id="fit-file"
        type="file"
        accept=".fit,.zip,application/zip,application/octet-stream"
        className="sr-only"
        aria-label="FIT or Garmin export file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      <Button type="button" variant="outline" className="h-11 w-full" disabled={state.kind === "uploading"} onClick={() => input.current?.click()}>
        <Upload /> {state.kind === "uploading" ? `Importing ${state.name}…` : "Upload FIT / Garmin export"}
      </Button>
      <p className="text-muted-foreground text-xs">
        Garmin Connect → activity → ⚙ → Export Original. Accepts the .zip or the .fit inside it.
      </p>
      {state.kind === "error" && (
        <p role="alert" className="text-destructive text-sm">
          {state.message}{" "}
          {state.duplicateId && (
            <Link href={`/train/activities/${state.duplicateId}`} className="underline">
              Open the existing activity
            </Link>
          )}
        </p>
      )}
    </div>
  );
}
