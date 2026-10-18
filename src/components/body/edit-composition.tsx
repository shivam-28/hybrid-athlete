"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";
import type { UnitSystem } from "@/lib/units";
import { CompositionForm, toPayload, type CompositionFormValues } from "./composition-form";

export function EditComposition(props: { id: string; initial: CompositionFormValues; units: UnitSystem }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>();
  return (
    <CompositionForm
      initial={props.initial}
      units={props.units}
      submitLabel="Save changes"
      pending={pending}
      fieldErrors={errors}
      onSubmit={async (values) => {
        setPending(true);
        const res = await api(`/api/body-composition/tests/${props.id}`, { method: "PATCH", body: { test: toPayload(values, props.units) } });
        setPending(false);
        if (!res.ok) return setErrors(res.details as Record<string, string[]>);
        router.push("/body/composition");
        router.refresh();
      }}
    />
  );
}
