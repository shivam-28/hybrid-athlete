import { handleHealthIngest } from "@/server/ingest/ingest";

/** Apple Health Shortcut endpoint: bearer ingest token only (excluded from src/proxy.ts). */
export function POST(request: Request) {
  return handleHealthIngest(request);
}
