import "server-only";
import { createAdminClient } from "@/server/supabase-admin";
import { USER_BUCKETS } from "./registry";
import { listObjectPaths } from "./storage";

/**
 * Permanently deletes a user: files first (Storage API; SQL deletes on storage
 * objects are blocked), then the auth user, which cascades to every row.
 * Idempotent: a re-run after a partial failure finishes the job.
 */
export async function deleteAccount(userId: string, buckets: readonly string[] = USER_BUCKETS): Promise<void> {
  const admin = createAdminClient();
  for (const bucket of buckets) {
    const paths = await listObjectPaths(admin, bucket, userId);
    if (paths.length > 0) {
      const { error } = await admin.storage.from(bucket).remove(paths);
      if (error) throw new Error(`Failed to delete files in ${bucket}`);
    }
  }
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error && error.status !== 404) throw new Error("Failed to delete account");
}
