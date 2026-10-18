"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { deleteActivity } from "./activities/activities";
import { requireUser } from "./auth";

export async function deleteActivityAction(activityId: string): Promise<void> {
  const { supabase } = await requireUser("/train/activities");
  await deleteActivity(supabase, activityId);
  revalidatePath("/train/activities");
  redirect("/train/activities");
}
