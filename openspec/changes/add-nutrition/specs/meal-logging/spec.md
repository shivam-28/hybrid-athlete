## Purpose

Lets users record what they ate with as little effort as possible: snap a photo, describe it in words or by voice, search a food database, or re-log a past meal. Every meal is stored as itemised nutrient data the user has confirmed, and totals are compared with the day's targets.

## ADDED Requirements

### Requirement: Meal photo capture
The system SHALL let the user take or choose a meal photo on iPhone and Mac. Before upload it SHALL resize the image so its longest edge is at most 1568 px and strip all EXIF metadata, and it SHALL store the photo in private storage readable only by its owner.

#### Scenario: Large photo from iPhone camera
- **WHEN** the user captures a 4032×3024 photo containing GPS EXIF data
- **THEN** the stored image is at most 1568 px on its longest edge and contains no EXIF metadata

#### Scenario: Another user requests the photo
- **WHEN** a different authenticated user requests the photo's storage path
- **THEN** access is denied

### Requirement: AI meal recognition
The system SHALL analyse a meal photo with the user's own Claude API key and return a list of food items, each with a name, estimated grams, preparation method and a confidence of `low`, `medium` or `high`. It SHALL reject AI output that does not match the expected structure and not save anything until the user confirms.

#### Scenario: Recognised plate
- **WHEN** the user submits a photo of chicken, rice and salad
- **THEN** a confirmation screen lists three items with estimated grams, preparation and confidence, and nothing is saved yet

#### Scenario: Malformed AI output
- **WHEN** the AI response does not validate against the item schema after one retry
- **THEN** the user sees an error offering text description or manual search, and no meal is saved

#### Scenario: Not food
- **WHEN** the photo contains no recognisable food
- **THEN** the user is told no food was found and offered manual entry

#### Scenario: No AI key
- **WHEN** a user without a stored Claude API key opens photo logging
- **THEN** photo and description recognition are disabled with a link to add a key, and manual food search remains available

### Requirement: Meal description parsing
The system SHALL accept a free-text meal description, typed or dictated, and turn it into the same itemised confirmation as photo recognition. Quantities stated by the user SHALL be used as given, and unstated quantities estimated and marked as estimated.

#### Scenario: Explicit and implicit quantities
- **WHEN** the user enters "200 g chicken breast with rice and a side salad"
- **THEN** chicken breast is listed at 200 g marked user-stated, and rice and salad have estimated grams marked estimated

### Requirement: Nutrient matching
The system SHALL match each recognised or described item to nutrient data per 100 g, preferring USDA FoodData Central for generic foods and Open Food Facts for branded or packaged products. When neither returns a match it SHALL fall back to a model-provided per-100 g estimate, and it SHALL label each item with its source (`usda`, `off`, or `estimated`).

#### Scenario: Generic food matched
- **WHEN** an item "cooked white rice" is matched
- **THEN** its nutrients come from USDA FoodData Central and its source label is `usda`

#### Scenario: No database match
- **WHEN** neither database returns a match for "grandma's lentil dal"
- **THEN** the item uses the model's per-100 g estimate and is visibly labelled "estimated"

#### Scenario: Database unavailable
- **WHEN** the nutrient database request fails or times out
- **THEN** the item falls back to the model estimate labelled "estimated" and the confirmation screen still loads

### Requirement: Editable confirmation
The system SHALL show, before saving, each item's grams, matched food, source, confidence and computed nutrients. It SHALL let the user change grams, swap the matched food from alternative matches or a search, remove items and add items, and SHALL recompute nutrients immediately on each edit. It SHALL show a notice that photo estimates can be off by 20–30% and that correcting grams improves accuracy.

#### Scenario: Adjust grams
- **WHEN** the user changes rice from 150 g to 220 g
- **THEN** the rice item's and meal's nutrients scale to 220 g before saving

#### Scenario: Low confidence highlighted
- **WHEN** an item has confidence `low`
- **THEN** it is visually highlighted for review on the confirmation screen

### Requirement: Saving meals
The system SHALL save a confirmed meal with its local date, time and meal type (`breakfast`, `lunch`, `dinner` or `snack`). The meal type SHALL be inferred from the local time (before 10:30 breakfast, 10:30–15:00 lunch, 17:00–21:30 dinner, otherwise snack) and be editable. Each item SHALL store grams, source, and nutrients: kcal, protein, carbohydrate, fat, fiber, sugar, saturated fat and sodium, plus potassium, calcium, iron, magnesium, vitamin D and vitamin B12 when the source provides them. Missing micronutrients SHALL be stored as unknown, not zero.

#### Scenario: Meal type inferred
- **WHEN** the user confirms a meal at 12:40 local time
- **THEN** it is saved as `lunch` on today's local date

#### Scenario: Unknown micronutrient
- **WHEN** an item's source provides no vitamin D value
- **THEN** vitamin D is stored as unknown and excluded from that day's vitamin D total with an "incomplete" indicator

### Requirement: Manual food search
The system SHALL let the user search foods by name across the nutrient databases, choose a result, enter grams and add it to a meal, without requiring an AI key.

#### Scenario: Search and add
- **WHEN** the user searches "skyr", picks a result and enters 170 g
- **THEN** the item is added with nutrients for 170 g and the source of the chosen result

### Requirement: Re-log recent and favourite meals
The system SHALL let the user mark a saved meal as a favourite and SHALL list favourites and the 20 most recent distinct meals. Re-logging one in a single action SHALL create a new meal for today at the current time with the same items and grams, still editable afterwards.

#### Scenario: One-tap breakfast
- **WHEN** the user taps a favourite "oats + whey + banana"
- **THEN** a new meal with identical items and grams is saved for today and appears in today's totals

### Requirement: Edit and delete meals
The system SHALL let the user edit any saved meal's items, grams, time and type, and delete a meal along with its photo. Day totals SHALL update immediately.

#### Scenario: Delete a meal
- **WHEN** the user deletes a meal with a photo
- **THEN** the meal, its items and its photo are removed and the day's totals decrease accordingly

### Requirement: Daily totals versus targets
The system SHALL show for each local day the totals of kcal, protein, carbohydrate, fat and fiber against that day's targets with remaining amounts, and the totals of the other stored nutrients. The Today view SHALL show kcal and macro progress with a quick action to log a meal by photo.

#### Scenario: Remaining amounts
- **WHEN** today's target is 2800 kcal and 144 g protein and the user has logged 1900 kcal and 100 g protein
- **THEN** the day view shows 900 kcal and 44 g protein remaining

#### Scenario: Over target
- **WHEN** logged kcal exceed the target
- **THEN** the overage is shown as a positive "over" amount rather than a negative remaining value
