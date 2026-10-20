import { vi } from "vitest";

/** A runAi double whose model call comes back with stop_reason "refusal". */
export function refusingAi() {
  const parse = vi.fn(async () => ({ stop_reason: "refusal", parsed_output: null }));
  const run = (<T>(call: (client: never) => Promise<T>) => call({ beta: { messages: { parse } } } as never)) as never;
  return { run, parse };
}
