## Purpose

Provides the catalogue of exercises users log against. It includes a seeded public-domain library and private custom exercises, each mapped to app muscle groups and a tracking mode, with search and filtering.

## ADDED Requirements

### Requirement: Seeded exercise library
The system SHALL provide a shared library of exercises imported from the free-exercise-db dataset. Each exercise SHALL have a name, category, equipment, level, mechanic, force, primary muscles, secondary muscles, instructions and image references from the source.

#### Scenario: Library available after setup
- **WHEN** a fresh instance has been migrated and seeded
- **THEN** every signed-in user can browse at least 800 seeded exercises, each with name, primary muscles and instructions

#### Scenario: Seeded exercises are read-only
- **WHEN** a user attempts to edit or delete a seeded exercise
- **THEN** the system rejects the change and the exercise is unchanged

### Requirement: Idempotent seeding
Re-running the exercise seed SHALL upsert exercises by their source identifier. It MUST NOT create duplicate exercises, and it MUST NOT alter users' sets, aliases or custom exercises.

#### Scenario: Seed runs twice
- **WHEN** the seed is executed twice against the same dataset version
- **THEN** the seeded exercise count is identical after each run and no exercise name appears twice among seeded exercises

#### Scenario: Seed updates an existing exercise
- **WHEN** the dataset version changes the instructions of an exercise and the seed is re-run
- **THEN** the existing exercise keeps its identifier, its instructions are updated, and all logged sets referencing it remain linked

### Requirement: Muscle-group mapping
Every exercise SHALL be mapped to one or more app muscle groups from the fixed set: chest, back, shoulders, biceps, triceps, forearms, core, glutes, quads, hamstrings, calves, full body, cardio. Each mapped group is marked primary or secondary.

#### Scenario: Source muscles mapped to app groups
- **WHEN** a seeded exercise lists source primary muscles "abdominals" and secondary muscles "lower back"
- **THEN** the exercise's primary group is core and its secondary group is back

#### Scenario: Every exercise has a primary group
- **WHEN** the seed completes
- **THEN** no exercise exists without at least one primary muscle group

### Requirement: Tracking modes
Every exercise SHALL have exactly one tracking mode: `weight_reps`, `bodyweight_reps` (reps with optional added weight), `duration` (time held), or `distance_duration`. The tracking mode SHALL determine which fields are required when logging a set of that exercise.

#### Scenario: Plank uses duration
- **WHEN** a user opens the seeded "Plank" exercise
- **THEN** its tracking mode is `duration` and logging a set requires a duration rather than reps

#### Scenario: Pull-up uses bodyweight reps
- **WHEN** a user opens a seeded pull-up exercise
- **THEN** its tracking mode is `bodyweight_reps`, reps are required, and added weight is optional

### Requirement: Search and filter
Users SHALL be able to search exercises by name with typo-tolerant matching and filter by muscle group and equipment. Seeded and the user's own custom exercises SHALL be returned together.

#### Scenario: Typo-tolerant search
- **WHEN** the user searches "dumbel shoulder pres"
- **THEN** results include "Dumbbell Shoulder Press" within the top 5

#### Scenario: Filter by muscle group and equipment
- **WHEN** the user filters by muscle group "shoulders" and equipment "dumbbell"
- **THEN** every result has shoulders as a primary or secondary group and uses dumbbell equipment

#### Scenario: No results
- **WHEN** the search matches nothing
- **THEN** the system shows an empty state offering to create a custom exercise with the searched name

### Requirement: Exercise detail
Users SHALL be able to view an exercise's instructions, images, equipment, muscle groups and tracking mode.

#### Scenario: View detail
- **WHEN** the user opens an exercise from search results
- **THEN** the system shows its instructions, at least one image when the source provides one, its equipment and its primary and secondary muscle groups

### Requirement: Private custom exercises
Users SHALL be able to create, edit and delete custom exercises with a name, equipment, tracking mode and at least one primary muscle group. A custom exercise MUST be visible only to the user who created it.

#### Scenario: Create custom exercise
- **WHEN** a user creates "Landmine Rotation" with tracking mode `weight_reps` and primary group core
- **THEN** it appears in that user's search results and can be logged in a session

#### Scenario: Custom exercise isolated from other users
- **WHEN** user B searches for "Landmine Rotation" created by user A
- **THEN** user B receives no result for it and cannot read it through any API

#### Scenario: Delete custom exercise with logged sets
- **WHEN** a user deletes a custom exercise that has logged sets
- **THEN** the exercise is archived instead of deleted: it is hidden from search and new logging, and its logged sets and history remain intact

#### Scenario: Delete unused custom exercise
- **WHEN** a user deletes a custom exercise that has no logged sets
- **THEN** the exercise is permanently removed
