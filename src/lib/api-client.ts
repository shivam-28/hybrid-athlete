export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string; message: string; details?: unknown };

/** JSON fetch for the app's own API routes, returning a typed success/error union instead of throwing. */
export async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, {
      method: init?.method ?? (init?.body === undefined ? "GET" : "POST"),
      headers: init?.body === undefined ? undefined : { "content-type": "application/json" },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, data: data as T };
    return { ok: false, status: res.status, error: data.error ?? "error", message: data.message ?? "Something went wrong.", details: data.details };
  } catch {
    return { ok: false, status: 0, error: "network", message: "You appear to be offline. Try again when you have signal." };
  }
}
