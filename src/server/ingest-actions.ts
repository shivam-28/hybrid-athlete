"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "./auth";
import { generateIngestToken, revokeIngestToken } from "./ingest/tokens";

export type GenerateTokenState = { token?: string; error?: string };

/** Returns the new token so the UI can show it once; it is never retrievable again. */
export async function generateIngestTokenAction(): Promise<GenerateTokenState> {
  const { user } = await requireUser("/settings");
  try {
    const token = await generateIngestToken(user.id);
    revalidatePath("/settings");
    return { token };
  } catch {
    return { error: "Could not create a token. Please try again." };
  }
}

export async function revokeIngestTokenAction(): Promise<void> {
  const { user } = await requireUser("/settings");
  await revokeIngestToken(user.id);
  revalidatePath("/settings");
}
