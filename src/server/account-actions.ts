"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { deleteAccount } from "./account/delete";
import { requireUser } from "./auth";

export type DeleteAccountState = { error?: string };

export async function deleteAccountAction(_: DeleteAccountState, formData: FormData): Promise<DeleteAccountState> {
  const { user } = await requireUser("/settings");
  if (formData.get("confirm") !== "DELETE") return { error: "Type DELETE in capitals to confirm." };
  await deleteAccount(user.id);
  // The user no longer exists server-side; just clear this device's session cookies.
  await (await createClient()).auth.signOut({ scope: "local" });
  redirect("/sign-in");
}
