## Why

Body-composition goals (fat loss, muscle gain, recomp) and endurance performance both depend on energy and protein intake far more than on any single workout, and a hybrid athlete's needs swing day to day: a 15 km long run needs a very different carb intake from a rest day. Manual food logging is tedious enough that most people quit, so this change makes logging as cheap as taking a photo. It also turns the data we already collect (profile, trend weight, body fat %, goals, synced activities) into deterministic daily targets and practical "what to eat next" suggestions.

## What Changes

- Deterministic daily nutrition targets (kcal, protein, carbs, fat, fiber) computed from BMR (Katch-McArdle when a recent body-fat measurement exists, otherwise Mifflin-St Jeor), lifestyle factor, the day's exercise energy, the body-tracking goal phase and rate. Includes RED-S energy-availability and BMR floors, training-day carb floors, an adaptive expenditure estimate once enough intake and weight data exists, and a "why this number" breakdown. Targets recompute when that day's activities sync.
- New profile field: lifestyle activity level (sedentary / lightly active / active, excluding workouts).
- Meal logging from a photo (resized, EXIF-stripped, analysed by Claude vision with the user's key), from a text or voice description, by manual food search, or by re-logging a recent or favourite meal. Every AI result is matched to nutrient data (USDA FoodData Central, Open Food Facts, else flagged model estimate) and shown on an editable confirmation screen before saving.
- Per-item nutrient storage: kcal, protein, carbs, fat, fiber, sugar, saturated fat, sodium, plus key micros when the source provides them (potassium, calcium, iron, magnesium, vitamin D, vitamin B12).
- Day view with totals vs targets and remaining amounts; meal edit and delete.
- "Rest of the day" meal recommendations from Claude within the remaining macros. They respect diet type, allergies, dislikes and cuisine preferences (new profile fields) and today's training timing. Allergens are re-checked server-side. One tap turns a suggestion into a planned meal that can later be logged as eaten.

## Non-goals

- Barcode scanning (later change).
- Multi-day or weekly meal planning, grocery lists.
- Supplement tracking, hydration tracking.
- Micronutrient RDA scoring or deficiency alerts.
- Letting the LLM compute or override targets.
- Medical or clinical nutrition advice (e.g. diabetes, eating-disorder treatment).

## Capabilities

### New Capabilities

- `nutrition-targets`: Deterministic daily energy and macro targets, expenditure model (formula and adaptive), goal adjustment, safety guardrails, training-day carb periodization, recomputation and explanation.
- `meal-logging`: Capturing meals by photo, text/voice description, food search or re-log; nutrient matching; confirmation and editing; per-item nutrient storage; daily totals vs targets.
- `meal-recommendations`: AI suggestions for the remaining meals of the day within remaining targets, honoring dietary preferences, allergies and training timing; converting a suggestion into a planned meal.

### Modified Capabilities

_None — profile additions (lifestyle activity level, diet type, allergies, dislikes, cuisine preferences) are introduced as requirements of the capabilities above so that `user-profile` does not need to be archived first._

## Impact

- Depends on: `add-foundation` (profile, AI key, timezone day boundaries), `add-workout-logging` (strength session times/durations), `add-activity-sync` (activities with active kcal and duration, daily metrics), `add-body-tracking` (trend weight, body-fat %/lean mass, goal phase and rate).
- New tables: `meals`, `meal_items`, `favorite_meals`, `daily_nutrition_targets` (cached per user/day), `planned_meals`; new profile columns for lifestyle level and dietary preferences. All with RLS.
- New external APIs: USDA FoodData Central (instance env var `USDA_FDC_API_KEY`), Open Food Facts (no key, User-Agent required). Anthropic API (user key) for vision, description parsing and recommendations.
- New private Storage bucket `meal-photos`.
- Today view gains a nutrition card (kcal and macro progress, remaining, quick "snap meal" action).
