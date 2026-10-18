import "server-only";
import { NextResponse, connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/database.types";
import { decideAccess } from "@/lib/access";

export type Profile = Tables<"profiles">;

async function loadSession() {
  // Session reads depend on the request and the clock; never prerender them.
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = user
    ? ((await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle()).data ?? null)
    : null;
  return { supabase, user, profile };
}

/**
 * For pages and server actions. Redirects anonymous users to sign-in and users
 * without a profile to onboarding. `path` is the page being rendered.
 */
export async function requireUser(path: string) {
  const session = await loadSession();
  const decision = decideAccess({ path, signedIn: !!session.user, hasProfile: !!session.profile });
  if (decision.kind !== "allow") redirect(decision.kind === "redirect" ? decision.to : "/sign-in");
  return session as typeof session & { user: NonNullable<typeof session.user> };
}

/** requireUser() for pages that need a completed profile (everything except onboarding). */
export async function requireProfile(path: string) {
  const session = await requireUser(path);
  return session as typeof session & { profile: Profile };
}

/** For route handlers: returns the session, or a 401/403 response to return as-is. */
export async function requireApiUser() {
  const session = await loadSession();
  if (!session.user) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) } as const;
  if (!session.profile) return { error: NextResponse.json({ error: "onboarding_required" }, { status: 403 }) } as const;
  return { ...session, user: session.user, profile: session.profile, error: null } as const;
}
