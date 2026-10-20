"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/field";
import { api } from "@/lib/api-client";
import type { ConsistencyWarning } from "@/lib/body/composition";
import { ClientImageError, reencodeForUpload } from "@/lib/images/normalize-client";
import { createClient } from "@/lib/supabase/client";
import type { UnitSystem } from "@/lib/units";
import { CompositionForm, toFormValues, toPayload, type CompositionFormValues } from "./composition-form";

const MAX_REPORT_BYTES = 10 * 1024 * 1024;
type Draft = { kind: "draft"; draft: Record<string, unknown> & { test_date: string | null }; notFound: string[]; warnings: ConsistencyWarning[] };

async function uploadReport(file: File): Promise<string> {
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  if (isPdf) {
    if (file.size > MAX_REPORT_BYTES) throw new ClientImageError("Reports must be 10 MB or smaller.");
    const res = await api<{ documentPath: string; token: string }>("/api/body-composition/upload", { body: { kind: "pdf" } });
    if (!res.ok) throw new ClientImageError(res.message);
    const { error } = await createClient().storage.from("body-comp-docs").uploadToSignedUrl(res.data.documentPath, res.data.token, file, { contentType: "application/pdf" });
    if (error) throw new ClientImageError("The PDF couldn't be uploaded. Please try again.");
    return res.data.documentPath;
  }
  let image: File;
  try {
    image = await reencodeForUpload(file, MAX_REPORT_BYTES);
  } catch (e) {
    if (e instanceof ClientImageError) throw new ClientImageError("Upload a JPEG, PNG or HEIC image, or a PDF, up to 10 MB.");
    throw e;
  }
  const form = new FormData();
  form.append("file", image);
  const res = await fetch("/api/body-composition/upload", { method: "POST", body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ClientImageError(data.message ?? "The image couldn't be uploaded.");
  return data.documentPath;
}

export function CompositionWizard(props: { units: UnitSystem; today: string; hasAiKey: boolean }) {
  const router = useRouter();
  const [documentPath, setDocumentPath] = useState<string | null>(null);
  const [form, setForm] = useState<{ values: CompositionFormValues; notFound?: string[] } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>();
  const blank = { ...toFormValues({ test_date: props.today }, props.units) };
  const fileInput = useRef<HTMLInputElement>(null);

  // A file picked before hydration never fires onChange; pick it up once mounted.
  useEffect(() => {
    const file = fileInput.current?.files?.[0];
    if (file) void onFile(file);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  async function onFile(file: File) {
    setError(null);
    setNotice(null);
    setBusy("Uploading…");
    try {
      const path = await uploadReport(file);
      setDocumentPath(path);
      if (!props.hasAiKey) {
        setNotice("Reading reports automatically needs your AI key. Your file is saved; enter the values by hand.");
        setForm({ values: blank });
        return;
      }
      setBusy("Reading your report…");
      const res = await api<Draft | { kind: "empty" }>("/api/body-composition/extract", { body: { documentPath: path } });
      if (!res.ok) {
        setNotice(res.message);
        setForm({ values: blank });
      } else if (res.data.kind === "empty") {
        setNotice("No body composition values were found in this file. You can enter them by hand.");
        setForm({ values: blank });
      } else {
        const values = toFormValues({ ...res.data.draft, test_date: res.data.draft.test_date ?? props.today }, props.units);
        setForm({ values, notFound: res.data.notFound });
        setNotice("Check every value against your report before saving. Fields marked 'Not found' weren't readable.");
      }
    } catch (e) {
      setError(e instanceof ClientImageError ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function save(values: CompositionFormValues) {
    setBusy("Saving…");
    const res = await api<{ id: string }>("/api/body-composition/tests", { body: { test: toPayload(values, props.units), documentPath } });
    setBusy(null);
    if (!res.ok) {
      setFieldErrors(res.details as Record<string, string[]>);
      setError(res.message);
      return;
    }
    router.push("/body/composition");
    router.refresh();
  }

  async function discard() {
    if (documentPath) await api("/api/body-composition/upload", { method: "DELETE", body: { documentPath } });
    router.push("/body/composition");
  }

  if (!form) {
    return (
      <div className="space-y-4">
        <Field id="report" label="Upload a report (photo or PDF)" hint="InBody, Tanita, DEXA or Withings printouts. JPEG, PNG, HEIC or PDF up to 10 MB.">
          <Input
            ref={fileInput}
            id="report"
            type="file"
            accept="image/*,application/pdf"
            className="h-11"
            disabled={!!busy}
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
        </Field>
        {!props.hasAiKey && (
          <p className="text-muted-foreground flex gap-2 text-sm">
            <FileUp className="size-4 shrink-0" aria-hidden /> Without an AI key the report is stored and you type the values in.
          </p>
        )}
        {busy && <p role="status" className="text-sm">{busy}</p>}
        {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
        <Button variant="outline" className="h-11 w-full" onClick={() => setForm({ values: blank })}>
          Enter values manually instead
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {notice && <p role="status" className="rounded-md border p-3 text-sm">{notice}</p>}
      {error && <p className="text-destructive text-sm">{error}</p>}
      <CompositionForm
        initial={form.values}
        notFound={form.notFound}
        units={props.units}
        submitLabel={documentPath ? "Confirm and save" : "Save test"}
        fieldErrors={fieldErrors}
        pending={!!busy}
        onSubmit={save}
        secondary={
          <Button type="button" variant="ghost" className="h-11 w-full" onClick={discard}>
            {documentPath ? "Discard (deletes the uploaded file)" : "Cancel"}
          </Button>
        }
      />
    </div>
  );
}
