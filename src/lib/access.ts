const PUBLIC_PATHS = new Set(["/", "/sign-in", "/manifest.webmanifest"]);
const PUBLIC_PREFIXES = ["/auth/"];

export const HOME_PATH = "/today";
export const ONBOARDING_PATH = "/onboarding";

export function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.has(path) || PUBLIC_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export type AccessDecision = { kind: "allow" } | { kind: "unauthorized" } | { kind: "redirect"; to: string };

export function decideAccess(input: { path: string; signedIn: boolean; hasProfile: boolean }): AccessDecision {
  const { path, signedIn, hasProfile } = input;
  if (!signedIn) {
    return path.startsWith("/api/")
      ? { kind: "unauthorized" }
      : { kind: "redirect", to: `/sign-in?next=${encodeURIComponent(path)}` };
  }
  if (path === ONBOARDING_PATH) {
    return hasProfile ? { kind: "redirect", to: HOME_PATH } : { kind: "allow" };
  }
  return hasProfile ? { kind: "allow" } : { kind: "redirect", to: ONBOARDING_PATH };
}

/** Only allow same-origin relative paths as post-sign-in destinations. */
export function safeNextPath(next: string | null | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : HOME_PATH;
}
