import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { createAdminClient } from "@/server/supabase-admin";
import { USER_BUCKETS, USER_TABLES } from "./registry";
import { listObjectPaths } from "./storage";

export const EXPORT_SCHEMA_VERSION = 1;
const FILE_LINK_TTL_SECONDS = 60 * 60;

export type AccountExport = {
  schema_version: number;
  exported_at: string;
  tables: Record<string, unknown[]>;
  files: { bucket: string; path: string; url: string }[];
};

/** Rows are read with the user's own RLS client, so the export cannot include anyone else's data. */
export async function buildExport(
  userClient: SupabaseClient<Database>,
  userId: string,
  buckets: readonly string[] = USER_BUCKETS,
): Promise<AccountExport> {
  const tables: Record<string, unknown[]> = {};
  for (const { table, select, ownRowsOnly } of USER_TABLES.filter((t) => t.export)) {
    const query = userClient.from(table).select(select ?? "*");
    const { data, error } = await (ownRowsOnly ? query.not("user_id", "is", null) : query);
    if (error) throw new Error(`Failed to export ${table}`);
    tables[table] = data;
  }

  const admin = createAdminClient();
  const files: AccountExport["files"] = [];
  for (const bucket of buckets) {
    const paths = await listObjectPaths(admin, bucket, userId);
    if (paths.length === 0) continue;
    const { data, error } = await admin.storage.from(bucket).createSignedUrls(paths, FILE_LINK_TTL_SECONDS);
    if (error || data.some((d) => !d.signedUrl || !d.path)) throw new Error(`Failed to sign ${bucket} files`);
    files.push(...data.map((d) => ({ bucket, path: d.path!, url: d.signedUrl! })));
  }

  return { schema_version: EXPORT_SCHEMA_VERSION, exported_at: new Date().toISOString(), tables, files };
}
