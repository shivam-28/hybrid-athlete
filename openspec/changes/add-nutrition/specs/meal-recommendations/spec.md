## Purpose

Answers "what should I eat for the rest of today?" with concrete, portioned meal options that fit the remaining targets, the user's dietary preferences and allergies, and today's training. A chosen option becomes a planned meal that is easy to log once eaten.

## ADDED Requirements

### Requirement: Dietary preferences
The system SHALL let the user record a diet type (`omnivore`, `vegetarian`, `vegan` or `pescatarian`, default `omnivore`), a list of allergies, a list of disliked foods and a list of preferred cuisines, and SHALL apply them to every recommendation.

#### Scenario: Vegetarian user
- **WHEN** a user with diet type `vegetarian` requests recommendations
- **THEN** no option contains meat or fish

### Requirement: Rest-of-day recommendations
The system SHALL, on request, generate 2 to 3 options with the user's Claude API key. The request uses remaining kcal, protein, carbohydrate and fat for today, the meal slots still ahead based on current local time, dietary preferences, and today's completed and planned training. Each option SHALL list one meal per remaining slot with foods, gram portions and approximate macros.

#### Scenario: Afternoon request
- **WHEN** at 15:30 local time the user has 1100 kcal and 60 g protein remaining and requests recommendations
- **THEN** 2–3 options are shown, each covering a snack and dinner with gram portions and per-meal macros

#### Scenario: Nothing remaining
- **WHEN** remaining kcal are zero or negative
- **THEN** no AI request is made and the user is told the day's target is already met, with an option for a low-calorie high-protein snack suggestion

#### Scenario: No AI key
- **WHEN** a user without a stored Claude API key opens recommendations
- **THEN** the feature is disabled with a link to add a key

### Requirement: Recommendation totals are verified
The system SHALL recompute each option's kcal and macros from its listed foods and grams using nutrient data where available, display the recomputed values labelled as estimates, and discard any option whose recomputed kcal differs from the remaining kcal by more than 15%.

#### Scenario: Option overshoots
- **WHEN** an option's recomputed kcal is 1400 against 1100 remaining
- **THEN** that option is not shown

#### Scenario: All options discarded
- **WHEN** every option fails verification after one regeneration attempt
- **THEN** the user is told no fitting suggestions could be made and no invalid options are displayed

### Requirement: Allergen safety
The system SHALL check every option's foods against the user's allergy list server-side, independently of the AI, and SHALL never display an option containing an allergen, including common derived ingredients (e.g., peanut butter for a peanut allergy).

#### Scenario: AI returns allergen
- **WHEN** the user is allergic to peanuts and an option includes satay sauce made with peanuts
- **THEN** that option is dropped before display

### Requirement: Training-aware suggestions
The system SHALL tell the recommender about today's training timing so that meals before a run of 90 minutes or more are carbohydrate-focused and low in fiber and fat. Meals after training include protein. Protein is distributed at roughly 0.3–0.4 g/kg per meal across the day's remaining meals.

#### Scenario: Long run this evening
- **WHEN** the user has a planned 100-minute run at 18:00 and requests recommendations at 14:00
- **THEN** the pre-run meal in each option is carbohydrate-focused and the post-run meal includes at least 0.3 g/kg protein

### Requirement: Planned meals from suggestions
The system SHALL let the user pick an option and save its meals as planned meals for today. A planned meal SHALL be logged as eaten in one action, with the same editable confirmation as other meals. Planned meals SHALL NOT count toward intake totals until logged.

#### Scenario: Plan then log
- **WHEN** the user saves an option and later taps "Ate this" on its dinner
- **THEN** the confirmation screen opens prefilled with the dinner's items and grams, and after confirming, the meal counts toward today's totals

#### Scenario: Planned meals do not inflate totals
- **WHEN** a planned meal exists but has not been logged
- **THEN** today's intake totals exclude it
