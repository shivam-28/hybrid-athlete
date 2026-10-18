"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { generateIngestTokenAction, revokeIngestTokenAction } from "@/server/ingest-actions";
import type { IngestTokenStatus } from "@/server/ingest/tokens";

export function IngestTokenSettings({ status }: { status: IngestTokenStatus | null }) {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const generate = () =>
    startTransition(async () => {
      const result = await generateIngestTokenAction();
      setError(result.error ?? null);
      setToken(result.token ?? null);
      setCopied(false);
    });

  const copy = async () => {
    if (!token) return;
    await navigator.clipboard.writeText(token);
    setCopied(true);
  };

  return (
    <div className="space-y-3">
      {status ? (
        <div className="flex items-center justify-between gap-3 rounded-md border p-3">
          <div>
            <p className="font-mono" aria-label="Active ingest token">
              {status.prefix}…{status.last4}
            </p>
            <p className="text-muted-foreground text-xs">Created {new Date(status.createdAt).toLocaleDateString()}</p>
          </div>
          <form action={revokeIngestTokenAction}>
            <Button type="submit" variant="outline" size="sm">Revoke</Button>
          </form>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">No ingest token is active.</p>
      )}
      {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
      <div className="flex gap-2">
        <Button type="button" className="h-11 flex-1" onClick={generate} disabled={pending}>
          {status ? "Rotate token" : "Generate token"}
        </Button>
        <Button asChild variant="outline" className="h-11 flex-1">
          <Link href="/settings/apple-health">Setup guide</Link>
        </Button>
      </div>

      <Dialog open={token !== null} onOpenChange={(open) => !open && setToken(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Your ingest token</DialogTitle>
            <DialogDescription>
              Copy it into your Shortcut now. It won&apos;t be shown again; if you lose it, rotate to get a new one. Anyone
              with this token can send data to your account, so don&apos;t share the Shortcut.
            </DialogDescription>
          </DialogHeader>
          <Input readOnly value={token ?? ""} aria-label="New ingest token" className="h-11 font-mono text-sm" onFocus={(e) => e.target.select()} />
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={copy}>
              {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
            </Button>
            <Button type="button" onClick={() => setToken(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
