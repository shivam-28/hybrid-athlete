/** Model IDs live here only. `main` reads photos/documents and writes plans; `fast` parses short voice/text logs. */
export const AI_MODEL_DEFAULTS = {
  main: "claude-opus-5-5",
  fast: "claude-haiku-4-5",
} as const;
