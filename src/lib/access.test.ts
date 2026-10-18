import { describe, expect, it } from "vitest";
import { decideAccess, isPublicPath, safeNextPath } from "./access";

describe("isPublicPath", () => {
  it.each(["/", "/sign-in", "/auth/confirm", "/manifest.webmanifest"])("%s is public", (p) => {
    expect(isPublicPath(p)).toBe(true);
  });
  it.each(["/today", "/settings", "/api/account/export", "/sign-in-evil"])("%s is protected", (p) => {
    expect(isPublicPath(p)).toBe(false);
  });
});

describe("decideAccess", () => {
  it("Given no session on a page, Then redirect to sign-in with next", () => {
    expect(decideAccess({ path: "/today", signedIn: false, hasProfile: false })).toEqual({
      kind: "redirect",
      to: "/sign-in?next=%2Ftoday",
    });
  });

  it("Given no session on an API route, Then 401", () => {
    expect(decideAccess({ path: "/api/account/export", signedIn: false, hasProfile: false })).toEqual({
      kind: "unauthorized",
    });
  });

  it("Given a session but no profile, Then redirect to onboarding", () => {
    expect(decideAccess({ path: "/today", signedIn: true, hasProfile: false })).toEqual({
      kind: "redirect",
      to: "/onboarding",
    });
  });

  it("Given a session but no profile on the onboarding page itself, Then allow", () => {
    expect(decideAccess({ path: "/onboarding", signedIn: true, hasProfile: false })).toEqual({ kind: "allow" });
  });

  it("Given a completed profile on the onboarding page, Then send to Today", () => {
    expect(decideAccess({ path: "/onboarding", signedIn: true, hasProfile: true })).toEqual({
      kind: "redirect",
      to: "/today",
    });
  });

  it("Given a session and a profile, Then allow", () => {
    expect(decideAccess({ path: "/settings", signedIn: true, hasProfile: true })).toEqual({ kind: "allow" });
  });
});

describe("safeNextPath", () => {
  it("keeps same-origin paths and rejects open redirects", () => {
    expect(safeNextPath("/today")).toBe("/today");
    expect(safeNextPath("//evil.com")).toBe("/today");
    expect(safeNextPath("https://evil.com")).toBe("/today");
    expect(safeNextPath(null)).toBe("/today");
  });
});
