/**
 * Server-side safety net for AI meal suggestions (design D7): runs independently
 * of the model. Matching is deliberately strict — a false alarm only drops a suggestion.
 */

// EU 14 allergen groups with common derived ingredients.
const ALLERGEN_GROUPS: Record<string, string[]> = {
  gluten: ["gluten", "wheat", "barley", "rye", "oat", "oatmeal", "spelt", "kamut", "couscous", "seitan", "bulgur", "semolina", "durum", "farro", "bread", "pasta", "spaghetti", "noodle", "flour", "cracker", "tortilla", "pita", "bagel", "croissant", "beer", "breadcrumb"],
  crustaceans: ["shrimp", "prawn", "crab", "lobster", "crayfish", "langoustine", "krill", "scampi"],
  egg: ["egg", "mayonnaise", "mayo", "meringue", "aioli", "hollandaise", "omelette", "omelet", "frittata", "quiche"],
  fish: ["fish", "salmon", "tuna", "cod", "haddock", "mackerel", "sardine", "anchovy", "anchovies", "trout", "herring", "pollock", "tilapia", "halibut", "surimi"],
  peanut: ["peanut", "groundnut", "satay", "monkey nut"],
  soy: ["soy", "soya", "tofu", "tempeh", "edamame", "miso", "tamari"],
  milk: ["milk", "dairy", "cheese", "butter", "cream", "yogurt", "yoghurt", "skyr", "whey", "casein", "kefir", "ghee", "paneer", "quark", "ricotta", "mozzarella", "parmesan", "feta", "custard", "latte", "cappuccino", "lactose"],
  tree_nuts: ["almond", "hazelnut", "walnut", "cashew", "pecan", "pistachio", "macadamia", "brazil nut", "praline", "marzipan", "nutella", "pesto", "nut butter"],
  celery: ["celery", "celeriac"],
  mustard: ["mustard", "dijon"],
  sesame: ["sesame", "tahini", "hummus", "houmous", "halva"],
  sulphites: ["sulphite", "sulfite", "wine", "dried apricot"],
  lupin: ["lupin", "lupine"],
  molluscs: ["mussel", "moules", "clam", "oyster", "squid", "octopus", "scallop", "snail", "calamari", "cuttlefish"],
};

// What users type → which groups to apply.
const ALLERGY_ALIASES: Record<string, (keyof typeof ALLERGEN_GROUPS)[]> = {
  gluten: ["gluten"], wheat: ["gluten"], coeliac: ["gluten"], celiac: ["gluten"],
  crustacean: ["crustaceans"], crustaceans: ["crustaceans"], shellfish: ["crustaceans", "molluscs"],
  egg: ["egg"], eggs: ["egg"],
  fish: ["fish"],
  peanut: ["peanut"], peanuts: ["peanut"], groundnut: ["peanut"],
  soy: ["soy"], soya: ["soy"],
  milk: ["milk"], dairy: ["milk"], lactose: ["milk"],
  nut: ["tree_nuts", "peanut"], nuts: ["tree_nuts", "peanut"], "tree nut": ["tree_nuts"], "tree nuts": ["tree_nuts"],
  celery: ["celery"], mustard: ["mustard"], sesame: ["sesame"],
  sulphites: ["sulphites"], sulfites: ["sulphites"], sulphite: ["sulphites"], sulfite: ["sulphites"],
  lupin: ["lupin"], mollusc: ["molluscs"], molluscs: ["molluscs"],
};

const MEAT = ["chicken", "beef", "pork", "lamb", "mutton", "turkey", "bacon", "ham", "sausage", "salami", "chorizo", "prosciutto", "pepperoni", "duck", "veal", "venison", "steak", "mince", "meatball", "gelatin", "gelatine", "lard", "goat"];
const SEAFOOD = [...ALLERGEN_GROUPS.fish!, ...ALLERGEN_GROUPS.crustaceans!, ...ALLERGEN_GROUPS.molluscs!];
const ANIMAL_PRODUCTS = [...ALLERGEN_GROUPS.milk!, ...ALLERGEN_GROUPS.egg!, "honey"];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Whole-word match allowing a plural "s"/"es", so "egg" does not match "eggplant". */
const wordRegex = (term: string) => new RegExp(`(^|[^a-z])${escape(term)}(s|es)?([^a-z]|$)`, "i");

export type AllergenHit = { allergy: string; term: string; text: string };

export function findAllergenHits(texts: readonly string[], allergies: readonly string[]): AllergenHit[] {
  const hits: AllergenHit[] = [];
  for (const raw of allergies) {
    const allergy = raw.trim().toLowerCase();
    if (!allergy) continue;
    const groups = ALLERGY_ALIASES[allergy];
    for (const text of texts) {
      const lower = text.toLowerCase();
      const term = groups
        ? groups.flatMap((g) => ALLERGEN_GROUPS[g]!).find((t) => wordRegex(t).test(lower))
        : lower.includes(allergy)
          ? allergy
          : undefined;
      if (term) hits.push({ allergy, term, text });
    }
  }
  return hits;
}

export type DietType = "omnivore" | "vegetarian" | "vegan" | "pescatarian";

/** Terms in the texts that the diet type excludes. */
export function dietViolations(texts: readonly string[], diet: DietType): string[] {
  const banned = diet === "vegan" ? [...MEAT, ...SEAFOOD, ...ANIMAL_PRODUCTS] : diet === "vegetarian" ? [...MEAT, ...SEAFOOD] : diet === "pescatarian" ? MEAT : [];
  return texts.flatMap((text) => banned.filter((term) => wordRegex(term).test(text.toLowerCase())));
}
