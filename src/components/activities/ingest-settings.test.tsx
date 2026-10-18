import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { IngestTokenSettings } from "./ingest-token-settings";
import { SyncStatus } from "./sync-status";

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const now = new Date("2026-06-15T12:00:00Z");

describe("IngestTokenSettings", () => {
  it("Given no active token, Then it offers to generate one", () => {
    const html = text(renderToStaticMarkup(<IngestTokenSettings status={null} />));
    expect(html).toContain("No ingest token is active");
    expect(html).toContain("Generate token");
    expect(html).not.toContain("Revoke");
  });

  it("Given an active token, Then only the masked form is shown with rotate and revoke", () => {
    const html = text(renderToStaticMarkup(<IngestTokenSettings status={{ prefix: "ha_AbCdE", last4: "wxyz", createdAt: "2026-06-01T10:00:00Z" }} />));
    expect(html).toContain("ha_AbCdE…wxyz");
    expect(html).toContain("Rotate token");
    expect(html).toContain("Revoke");
  });
});

describe("SyncStatus", () => {
  it("Given no successful sync, Then it shows Never synced with a link to the guide", () => {
    const html = renderToStaticMarkup(<SyncStatus lastSync={null} timezone="Europe/Copenhagen" now={now} />);
    expect(text(html)).toContain("Never synced");
    expect(html).toContain('href="/settings/apple-health"');
  });

  it("Given a sync 2 hours ago, Then the time is shown in the user's timezone with counts and no warning", () => {
    const html = renderToStaticMarkup(
      <SyncStatus lastSync={{ at: "2026-06-15T10:00:00Z", counts: { inserted: 2, updated: 1, unchanged: 5 } }} timezone="Europe/Copenhagen" now={now} />,
    );
    expect(text(html)).toContain("15 Jun 2026, 12:00");
    expect(text(html)).toContain("2 new, 1 updated, 5 unchanged");
    expect(html).not.toContain('role="alert"');
  });

  it("Given the last sync was over 36 hours ago, Then a stale warning is shown", () => {
    const html = renderToStaticMarkup(
      <SyncStatus lastSync={{ at: "2026-06-13T20:00:00Z", counts: { inserted: 0, updated: 0, unchanged: 3 } }} timezone="Europe/Copenhagen" now={now} />,
    );
    expect(html).toContain('role="alert"');
    expect(text(html)).toContain("No sync for over 36 hours");
  });
});
