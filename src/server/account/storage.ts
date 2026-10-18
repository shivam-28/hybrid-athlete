import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** All object paths under `prefix` in a bucket, descending into folders. */
export async function listObjectPaths(admin: SupabaseClient, bucket: string, prefix: string): Promise<string[]> {
  const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error) throw new Error(`Failed to list ${bucket}/${prefix}`);
  const nested = await Promise.all(
    data.map((entry) =>
      entry.id === null ? listObjectPaths(admin, bucket, `${prefix}/${entry.name}`) : [`${prefix}/${entry.name}`],
    ),
  );
  return nested.flat();
}
