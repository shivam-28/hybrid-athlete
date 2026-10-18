## Purpose

Computes each user's daily energy, macronutrient and fiber targets deterministically from their body data, training and goals, with safety guardrails and a transparent explanation, so intake can be steered toward body-composition and performance goals without the LLM ever deciding the numbers.

## ADDED Requirements

### Requirement: Lifestyle activity level
The system SHALL let the user set a lifestyle activity level describing activity outside of workouts, one of `sedentary`, `lightly_active` or `active`, defaulting to `sedentary`, and SHALL use it as the non-exercise expenditure multiplier of 1.2, 1.35 or 1.5 respectively.

#### Scenario: Default level
- **WHEN** a user who has never set a lifestyle activity level requests today's targets
- **THEN** the multiplier 1.2 is used and the explanation shows "sedentary (1.2)"

#### Scenario: Changing level
- **WHEN** the user changes the lifestyle activity level from `sedentary` to `active`
- **THEN** today's and future days' targets are recomputed with multiplier 1.5 and past days' stored targets are unchanged

### Requirement: BMR formula selection
The system SHALL compute basal metabolic rate with Katch-McArdle (370 + 21.6 × lean mass kg) when the user has a confirmed body-fat percentage measured within the last 90 days, and with Mifflin-St Jeor (10 × weight kg + 6.25 × height cm − 5 × age years + 5 for male, −161 for female) otherwise, using the user's current trend weight.

#### Scenario: Recent body-fat measurement
- **WHEN** the user's latest confirmed body-fat measurement is 20% taken 30 days ago and trend weight is 80 kg
- **THEN** BMR is 370 + 21.6 × 64 = 1752 kcal (rounded to whole kcal) and the method is labelled "Katch-McArdle"

#### Scenario: Stale or missing body-fat measurement
- **WHEN** the user's latest body-fat measurement is 120 days old
- **THEN** BMR is computed with Mifflin-St Jeor and the explanation states that body fat is older than 90 days

#### Scenario: Missing required inputs
- **WHEN** the user has no weight entry, or sex, date of birth or height is missing from the profile
- **THEN** no target is produced and the user is told which inputs are missing with a link to provide them

### Requirement: Daily exercise energy
The system SHALL compute the day's exercise energy as the sum of active kcal from synced or imported activities on that local day plus, for each logged strength session not overlapping in time with an activity that has active kcal, an estimate of 5 MET × trend weight kg × session hours, so that the same session is never counted twice.

#### Scenario: Watch-recorded run and app-logged lifting
- **WHEN** the day has a synced run with 850 active kcal and a 60-minute strength session at 80 kg body weight that no synced activity overlaps
- **THEN** exercise energy is 850 + 400 = 1250 kcal

#### Scenario: Strength session also recorded by the watch
- **WHEN** a 60-minute strength session overlaps in time with a synced strength activity reporting 320 active kcal
- **THEN** exercise energy includes 320 kcal for that session and no MET estimate

#### Scenario: Activity syncs later in the day
- **WHEN** a 15 km run with 1000 active kcal syncs at 14:00 local time
- **THEN** today's targets are recomputed and the kcal target increases accordingly the next time targets are read

### Requirement: Adaptive expenditure estimate
The system SHALL estimate the user's actual total daily expenditure from data once, within the trailing 28 days, at least 14 days have complete food logs and at least 10 weigh-ins exist, as mean intake on complete days − (trend-weight change kg × 7700 ÷ days in window). It SHALL derive the non-exercise baseline from it by subtracting the mean daily exercise energy of the same window, blend that baseline with the formula baseline weighted by data completeness, and show which method is active.

#### Scenario: Insufficient data
- **WHEN** the user has 9 complete food-log days in the last 28 days
- **THEN** the formula baseline is used and the explanation says how many more complete days are needed

#### Scenario: Sufficient data
- **WHEN** the user has 28 complete days and 20 weigh-ins with mean intake 2600 kcal and trend weight falling 1.0 kg over 28 days
- **THEN** estimated expenditure is 2600 + 275 = 2875 kcal per day and the explanation labels the method "Adaptive (based on your data)"

#### Scenario: Incomplete days are excluded
- **WHEN** a day in the window is not marked complete by the user
- **THEN** that day's intake is excluded from the mean intake calculation

### Requirement: Food log completeness
The system SHALL let the user mark a day's food log as complete or incomplete, defaulting to incomplete, and SHALL only use complete days as intake evidence.

#### Scenario: Marking a day complete
- **WHEN** the user marks yesterday's log complete
- **THEN** yesterday counts toward the adaptive expenditure window

### Requirement: Goal energy adjustment
The system SHALL adjust maintenance energy by the body-tracking goal phase. A cut subtracts target rate kg per week × 7700 ÷ 7 kcal, with the rate defaulting to 0.5% of trend weight per week and the deficit capped at 25% of maintenance. A lean gain adds 250 kcal. A recomposition subtracts 5% of maintenance. Maintenance adds nothing.

#### Scenario: Default cut
- **WHEN** a user weighing 80 kg is in a cut with no explicit rate and maintenance is 2800 kcal
- **THEN** the deficit is 0.4 × 7700 ÷ 7 = 440 kcal and the target is 2360 kcal

#### Scenario: Aggressive rate capped
- **WHEN** the requested rate implies a deficit larger than 25% of maintenance
- **THEN** the deficit is limited to 25% of maintenance and the explanation states that the rate was capped

#### Scenario: No goal set
- **WHEN** the user has no body-tracking goal
- **THEN** the maintenance phase is used and the user is prompted to set a goal

### Requirement: Energy safety floors
The system SHALL never produce a kcal target below the user's BMR. When fat-free mass is known it SHALL never produce a target where (target − exercise energy) ÷ fat-free mass kg is below 30 kcal/kg. When a floor raises the target it SHALL show a warning naming the floor.

#### Scenario: BMR floor
- **WHEN** the goal-adjusted target is 1500 kcal and BMR is 1650 kcal
- **THEN** the target is 1650 kcal and a warning states that the target was raised to BMR

#### Scenario: Low energy availability on a long-run day
- **WHEN** fat-free mass is 60 kg, exercise energy is 1200 kcal and the goal-adjusted target is 2700 kcal
- **THEN** the target is raised to 1200 + 30 × 60 = 3000 kcal with a low-energy-availability warning

### Requirement: Macronutrient targets
The system SHALL set protein at 2.0 g/kg in cut or recomposition phases and 1.8 g/kg otherwise. The reference weight is the goal weight instead of trend weight when body fat exceeds 25% (male) or 32% (female). Fat is 25% of target kcal with a minimum of 0.6 g/kg trend weight. Carbohydrate is the remaining energy at 4 kcal/g. Fiber is 14 g per 1000 kcal.

#### Scenario: Standard split
- **WHEN** an 80 kg male at 18% body fat is in maintenance with a 2800 kcal target
- **THEN** protein is 144 g, fat is 78 g, carbohydrate is (2800 − 576 − 700) ÷ 4 = 381 g and fiber is 39 g

#### Scenario: High body fat uses goal weight
- **WHEN** a male at 30% body fat weighs 100 kg with a goal weight of 85 kg in a cut
- **THEN** protein is 2.0 × 85 = 170 g

### Requirement: Training-day carbohydrate floor
The system SHALL classify each day by its longest run (rest/easy, run ≥ 60 min, run ≥ 90 min) and enforce a carbohydrate floor of 3, 5 or 6 g/kg trend weight respectively. When the floor cannot be met within the kcal target, the kcal target SHALL be raised to fit it and a warning shown, rather than reducing carbohydrate below the floor.

#### Scenario: Long run raises carbs
- **WHEN** an 80 kg user in a cut has a 100-minute run today and the computed carbohydrate is 300 g
- **THEN** carbohydrate becomes 480 g, the kcal target increases by 720 kcal and the explanation states "long-run day carb floor"

#### Scenario: Rest day floor already met
- **WHEN** the computed carbohydrate is above 3 g/kg on a rest day
- **THEN** targets are unchanged by the floor

### Requirement: Target explanation
The system SHALL show, for any day's targets, each component with its value and source: BMR and method, baseline, exercise energy per activity, goal adjustment, floors applied, macro reference weight and expenditure method.

#### Scenario: Viewing why
- **WHEN** the user opens "Why this number" on today's targets
- **THEN** every component that contributed to the kcal and macro targets is listed with its value and they sum to the displayed target

### Requirement: Target history is stable
The system SHALL store each past day's targets as computed at the end of that day, so that later changes to profile, goals or formula inputs do not alter historical targets. Today's targets SHALL stay live until the day ends in the user's timezone.

#### Scenario: Profile change does not rewrite history
- **WHEN** the user changes their goal today
- **THEN** yesterday's displayed targets are unchanged and today's targets reflect the new goal
