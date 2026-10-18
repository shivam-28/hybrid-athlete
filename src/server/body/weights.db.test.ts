import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Profile } from "@/server/auth";
import { createTestUser, deleteTestUser, sampleProfile, type TestUser } from "../../../tests/supabase-test-helpers";
import { BodyError } from "./errors";
import { addMeasurement, addWeight, deleteWeight, listDailyWeights, updateWeight } from "./weights";

let a: TestUser;
let b: TestUser;
let metric: Profile;
let imperial: Profile;

beforeAll(async () => {
  a = await createTestUser();
  b = await createTestUser();
  await a.client.from("profiles").insert(sampleProfile);
  await b.client.from("profiles").insert({ ...sampleProfile, unit_system: "imperial" });
  metric = (await a.client.from("profiles").select("*").single()).data!;
  imperial = (await b.client.from("profiles").select("*").single()).data!;
});

afterAll(async () => {
  await deleteTestUser(a);
  await deleteTestUser(b);
});

describe("addWeight", () => {
  it("Given 78.4 kg at 07:10 Copenhagen, Then it is stored with that time and day", async () => {
    const row = await addWeight(a.client, metric, { weight: "78.4", unit: "kg", occurred_at: "2026-10-01T05:10:00Z" });
    expect(Number(row.weight_kg)).toBe(78.4);
    expect(row.local_date).toBe("2026-10-01");
    expect(row.occurred_at).toBe("2026-10-01T05:10:00+00:00");
  });

  it("Given 172.8 lb, Then 78.38 kg is stored", async () => {
    const row = await addWeight(b.client, imperial, { weight: 172.8, unit: "lb", occurred_at: "2026-10-01T05:10:00Z" });
    expect(Number(row.weight_kg)).toBe(78.38);
  });

  it("Given 23:30 UTC on 14 March in Copenhagen, Then the entry counts toward 15 March", async () => {
    const row = await addWeight(a.client, metric, { weight: 79, unit: "kg", occurred_at: "2026-03-14T23:30:00Z" });
    expect(row.local_date).toBe("2026-03-15");
  });

  it("Given no time, Then now is used", async () => {
    const row = await addWeight(a.client, metric, { weight: 79, unit: "kg" }, new Date("2026-10-05T06:00:00Z"));
    expect(row.local_date).toBe("2026-10-05");
  });

  it.each([19.9, 400.1])("Given %s kg, Then it is rejected and nothing is stored", async (weight) => {
    const before = (await a.client.from("body_weights").select("id")).data!.length;
    await expect(addWeight(a.client, metric, { weight, unit: "kg" })).rejects.toBeInstanceOf(BodyError);
    expect((await a.client.from("body_weights").select("id")).data).toHaveLength(before);
  });
});

describe("editing and deleting", () => {
  it("Given the user's own entry, When edited, Then the new value is stored", async () => {
    const row = await addWeight(a.client, metric, { weight: 80, unit: "kg", occurred_at: "2026-10-02T05:00:00Z" });
    const updated = await updateWeight(a.client, metric, row.id, { weight: 79.5, unit: "kg" });
    expect(Number(updated.weight_kg)).toBe(79.5);
    expect(updated.local_date).toBe("2026-10-02");
  });

  it("Given another user's entry, When edited or deleted, Then not found and nothing changes", async () => {
    const row = await addWeight(a.client, metric, { weight: 81, unit: "kg", occurred_at: "2026-10-03T05:00:00Z" });
    await expect(updateWeight(b.client, imperial, row.id, { weight: 100, unit: "lb" })).rejects.toMatchObject({ code: "not_found" });
    await expect(deleteWeight(b.client, row.id)).rejects.toMatchObject({ code: "not_found" });
    expect(Number((await a.client.from("body_weights").select("weight_kg").eq("id", row.id).single()).data!.weight_kg)).toBe(81);
  });

  it("Given a deleted manual entry on an Apple Health day, Then the daily weight falls back", async () => {
    await a.client.from("daily_metrics").insert({ local_date: "2026-10-04", occurred_at: "2026-10-03T22:00:00Z", weight_kg: 78.9 });
    const row = await addWeight(a.client, metric, { weight: 78.4, unit: "kg", occurred_at: "2026-10-04T05:00:00Z" });
    expect((await listDailyWeights(a.client)).find((d) => d.date === "2026-10-04")?.weightKg).toBe(78.4);
    await deleteWeight(a.client, row.id);
    expect((await listDailyWeights(a.client)).find((d) => d.date === "2026-10-04")).toEqual({
      date: "2026-10-04",
      weightKg: 78.9,
      source: "apple_health",
    });
  });
});

describe("addMeasurement", () => {
  it("Given only a waist of 86.5 cm, Then it is stored with other fields empty", async () => {
    const row = await addMeasurement(a.client, metric, { unit: "cm", waist: "86.5", date: "2026-10-01" });
    expect(Number(row.waist_cm)).toBe(86.5);
    expect(row.hips_cm).toBeNull();
    expect(row.local_date).toBe("2026-10-01");
    expect(row.occurred_at).toBe("2026-09-30T22:00:00+00:00");
  });

  it("Given inches, Then centimetres are stored", async () => {
    const row = await addMeasurement(b.client, imperial, { unit: "in", waist: 34, date: "2026-10-01" });
    expect(Number(row.waist_cm)).toBe(86.4);
  });

  it("Given no fields, Then it is rejected", async () => {
    await expect(addMeasurement(a.client, metric, { unit: "cm" })).rejects.toMatchObject({ code: "invalid" });
  });

  it.each([5, 300])("Given a waist of %s cm, Then it is rejected", async (waist) => {
    await expect(addMeasurement(a.client, metric, { unit: "cm", waist })).rejects.toMatchObject({ code: "invalid" });
  });
});
