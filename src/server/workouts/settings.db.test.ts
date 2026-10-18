import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, createTestUser, deleteTestUser, sampleProfile, type TestUser } from "../../../tests/supabase-test-helpers";
import { clearProgressionSettings, deleteAlias, getProgressionSettings, listAliases, saveProgressionSettings } from "./settings";

let u: TestUser;
let raise: string;
let other: string;

beforeAll(async () => {
  u = await createTestUser();
  await u.client.from("profiles").insert(sampleProfile);
  await adminClient().rpc("seed_exercises", {
    p_exercises: ["settest-raise", "settest-other"].map((source_id) => ({
      source_id,
      name: source_id,
      search_name: source_id,
      tracking_mode: "weight_reps",
      instructions: [],
      image_paths: [],
      muscles: [{ group: "shoulders", role: "primary" }],
    })),
  });
  const { data } = await adminClient().from("exercises").select("id, source_id").in("source_id", ["settest-raise", "settest-other"]);
  raise = data!.find((e) => e.source_id === "settest-raise")!.id;
  other = data!.find((e) => e.source_id === "settest-other")!.id;
});

afterAll(async () => {
  await deleteTestUser(u);
  await adminClient().from("exercises").delete().in("source_id", ["settest-raise", "settest-other"]);
});

describe("progression settings overrides", () => {
  it("Given an increment override of 1 kg, Then it applies to that exercise only", async () => {
    await saveProgressionSettings(u.client, raise, { rep_min: null, rep_max: null, increment_kg: 1, duration_increment_s: null });
    expect(await getProgressionSettings(u.client, raise)).toMatchObject({ increment_kg: 1 });
    expect(await getProgressionSettings(u.client, other)).toBeNull();
  });

  it("updates an existing override and rejects an inverted rep range", async () => {
    await saveProgressionSettings(u.client, raise, { rep_min: 12, rep_max: 20, increment_kg: 1, duration_increment_s: null });
    expect(await getProgressionSettings(u.client, raise)).toMatchObject({ rep_min: 12, rep_max: 20 });
    await expect(saveProgressionSettings(u.client, raise, { rep_min: 15, rep_max: 10, increment_kg: null, duration_increment_s: null })).rejects.toMatchObject({
      code: "invalid",
    });
  });

  it("clears an override back to defaults", async () => {
    await clearProgressionSettings(u.client, raise);
    expect(await getProgressionSettings(u.client, raise)).toBeNull();
  });
});

describe("aliases", () => {
  it("lists aliases with exercise names and deletes them", async () => {
    await u.client.from("exercise_aliases").insert({ phrase_normalised: "side raise thing", exercise_id: raise });
    const aliases = await listAliases(u.client);
    expect(aliases).toEqual([{ id: expect.any(String), phrase: "side raise thing", exerciseName: "settest-raise" }]);
    await deleteAlias(u.client, aliases[0]!.id);
    expect(await listAliases(u.client)).toEqual([]);
  });
});
