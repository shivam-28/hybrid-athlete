import { describe, expect, it } from "vitest";
import { mapMuscles, toSeedRow, trackingModeFor, type SourceExercise } from "./seed-transform";

const base: SourceExercise = {
  id: "X",
  name: "X",
  force: "push",
  level: "beginner",
  mechanic: "compound",
  equipment: "barbell",
  primaryMuscles: [],
  secondaryMuscles: [],
  instructions: ["Do it."],
  category: "strength",
  images: ["X/0.jpg"],
};

describe("mapMuscles", () => {
  it("Given abdominals primary and lower back secondary, Then core primary and back secondary", () => {
    expect(mapMuscles({ ...base, primaryMuscles: ["abdominals"], secondaryMuscles: ["lower back"] })).toEqual([
      { group: "core", role: "primary" },
      { group: "back", role: "secondary" },
    ]);
  });

  it.each([
    ["middle back", "back"],
    ["lats", "back"],
    ["traps", "back"],
    ["neck", "shoulders"],
    ["quadriceps", "quads"],
    ["adductors", "quads"],
    ["abductors", "glutes"],
    ["calves", "calves"],
    ["hamstrings", "hamstrings"],
    ["chest", "chest"],
  ])("maps %s to %s", (source, group) => {
    expect(mapMuscles({ ...base, primaryMuscles: [source] })).toEqual([{ group, role: "primary" }]);
  });

  it("drops secondary groups that are already primary and de-duplicates", () => {
    expect(mapMuscles({ ...base, primaryMuscles: ["lats"], secondaryMuscles: ["middle back", "traps", "biceps"] })).toEqual([
      { group: "back", role: "primary" },
      { group: "biceps", role: "secondary" },
    ]);
  });

  it("adds cardio for cardio exercises and full body for olympic lifts", () => {
    expect(mapMuscles({ ...base, category: "cardio", primaryMuscles: ["quadriceps"] })).toContainEqual({ group: "cardio", role: "primary" });
    expect(mapMuscles({ ...base, category: "olympic weightlifting", primaryMuscles: ["shoulders"] })).toContainEqual({
      group: "full_body",
      role: "primary",
    });
  });

  it("adds full body when primaries span upper body, core and lower body", () => {
    expect(mapMuscles({ ...base, primaryMuscles: ["chest", "abdominals", "glutes"] })).toContainEqual({ group: "full_body", role: "primary" });
  });

  it("falls back to full body when the source lists no primary muscles", () => {
    expect(mapMuscles({ ...base, primaryMuscles: [] })).toEqual([{ group: "full_body", role: "primary" }]);
  });
});

describe("trackingModeFor", () => {
  it("uses the explicit override map first", () => {
    expect(trackingModeFor({ ...base, id: "Farmers_Walk", name: "Farmer's Walk", equipment: "other" })).toBe("distance_duration");
    expect(trackingModeFor({ ...base, id: "Weighted_Pull_Ups", name: "Weighted Pull Ups", equipment: "other" })).toBe("bodyweight_reps");
    expect(trackingModeFor({ ...base, id: "Push_Up_to_Side_Plank", name: "Push Up to Side Plank", equipment: "body only" })).toBe(
      "bodyweight_reps",
    );
  });

  it("Given a hold such as Plank, Then duration", () => {
    expect(trackingModeFor({ ...base, id: "Plank", name: "Plank", equipment: "body only" })).toBe("duration");
    expect(trackingModeFor({ ...base, name: "Wall Sit", equipment: "body only" })).toBe("duration");
  });

  it("does not treat hang cleans or hanging leg raises as holds", () => {
    expect(trackingModeFor({ ...base, name: "Hang Clean", equipment: "barbell" })).toBe("weight_reps");
    expect(trackingModeFor({ ...base, name: "Hanging Leg Raise", equipment: "body only" })).toBe("bodyweight_reps");
  });

  it("Given cardio, Then distance/duration; given a stretch, Then duration", () => {
    expect(trackingModeFor({ ...base, name: "Rowing, Stationary", category: "cardio", equipment: "machine" })).toBe("distance_duration");
    expect(trackingModeFor({ ...base, name: "Hamstring Stretch", category: "stretching", equipment: "body only" })).toBe("duration");
  });

  it("Given body-only equipment, Then bodyweight reps; otherwise weight × reps", () => {
    expect(trackingModeFor({ ...base, id: "Pullups", name: "Pullups", equipment: "body only" })).toBe("bodyweight_reps");
    expect(trackingModeFor({ ...base, name: "Barbell Squat", equipment: "barbell" })).toBe("weight_reps");
    expect(trackingModeFor({ ...base, name: "Mystery", equipment: null })).toBe("weight_reps");
  });
});

describe("toSeedRow", () => {
  it("produces a complete seed row", () => {
    const row = toSeedRow({ ...base, id: "Dumbbell_Shoulder_Press", name: "Dumbbell Shoulder Press", equipment: "dumbbell", primaryMuscles: ["shoulders"], secondaryMuscles: ["triceps"] });
    expect(row).toEqual({
      source_id: "Dumbbell_Shoulder_Press",
      name: "Dumbbell Shoulder Press",
      search_name: "dumbbell shoulder press",
      category: "strength",
      equipment: "dumbbell",
      level: "beginner",
      mechanic: "compound",
      force: "push",
      tracking_mode: "weight_reps",
      instructions: ["Do it."],
      image_paths: ["X/0.jpg"],
      muscles: [
        { group: "shoulders", role: "primary" },
        { group: "triceps", role: "secondary" },
      ],
    });
  });
});
