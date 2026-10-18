import { describe, expect, it } from "vitest";
import { dietViolations, findAllergenHits } from "./allergens";

describe("findAllergenHits", () => {
  it("Given a peanut allergy, Then satay and peanut butter are caught", () => {
    expect(findAllergenHits(["Chicken satay with rice"], ["peanuts"])).toHaveLength(1);
    expect(findAllergenHits(["Toast with peanut butter"], ["peanut"])).toHaveLength(1);
    expect(findAllergenHits(["Groundnut stew"], ["peanuts"])).toHaveLength(1);
  });

  it("Given a milk allergy, Then whey and skyr are caught", () => {
    expect(findAllergenHits(["Whey protein shake"], ["milk"]).map((h) => h.term)).toEqual(["whey"]);
    expect(findAllergenHits(["Skyr bowl with berries"], ["dairy"]).map((h) => h.term)).toEqual(["skyr"]);
  });

  it("Given a free-text allergy not in the map, Then it matches literally as a substring", () => {
    expect(findAllergenHits(["Kiwifruit smoothie"], ["kiwi"])).toHaveLength(1);
  });

  it("Given a shellfish allergy, Then crustaceans and molluscs are both caught", () => {
    expect(findAllergenHits(["Garlic prawns"], ["shellfish"])).toHaveLength(1);
    expect(findAllergenHits(["Moules with mussels"], ["shellfish"])).toHaveLength(1);
  });

  it("Given a clean option, Then nothing is flagged", () => {
    expect(findAllergenHits(["Grilled chicken", "Rice", "Steamed broccoli"], ["peanuts", "milk"])).toEqual([]);
  });

  it("does not flag eggplant for an egg allergy", () => {
    expect(findAllergenHits(["Roasted eggplant"], ["egg"])).toEqual([]);
    expect(findAllergenHits(["Scrambled eggs"], ["egg"])).toHaveLength(1);
  });
});

describe("dietViolations", () => {
  it("Given a vegetarian, Then meat and fish are violations", () => {
    expect(dietViolations(["Chicken curry"], "vegetarian")).toEqual(["chicken"]);
    expect(dietViolations(["Salmon fillet"], "vegetarian")).toEqual(["salmon"]);
    expect(dietViolations(["Paneer tikka", "Dal"], "vegetarian")).toEqual([]);
  });

  it("Given a vegan, Then dairy, eggs and honey are also violations", () => {
    expect(dietViolations(["Greek yogurt with honey"], "vegan")).toEqual(["yogurt", "honey"]);
  });

  it("Given a pescatarian, Then fish is fine but meat is not", () => {
    expect(dietViolations(["Tuna salad"], "pescatarian")).toEqual([]);
    expect(dietViolations(["Beef burger"], "pescatarian")).toEqual(["beef"]);
  });

  it("Given an omnivore, Then nothing is a violation", () => {
    expect(dietViolations(["Pork chop"], "omnivore")).toEqual([]);
  });
});
