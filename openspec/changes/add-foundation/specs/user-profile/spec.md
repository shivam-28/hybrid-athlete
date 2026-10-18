## Purpose

Captures the personal and physiological details that training and nutrition calculations depend on, together with each user's unit and timezone preferences.

## ADDED Requirements

### Requirement: Onboarding
The system SHALL require a newly signed-in user to complete onboarding before using the rest of the app, collecting display name, sex used for physiological formulas (male or female), date of birth, height, unit system, timezone, strength training experience (beginner, intermediate, advanced), and running experience (none, beginner, intermediate, advanced).

#### Scenario: First sign-in
- **WHEN** a user signs in for the first time
- **THEN** they are shown onboarding and cannot reach other app pages until required fields are saved

#### Scenario: Sex field explanation
- **WHEN** the user reaches the sex field
- **THEN** the form explains that it is used only for metabolic and heart-rate formulas

### Requirement: Profile validation
The system SHALL reject profile values outside plausible human ranges: age below 13 or above 100 years, and height below 100 cm or above 250 cm.

#### Scenario: Implausible height
- **WHEN** the user enters a height of 300 cm
- **THEN** the profile is not saved and the height field shows a validation error

#### Scenario: Under-age user
- **WHEN** the date of birth implies an age under 13
- **THEN** onboarding cannot be completed and a message explains the minimum age

### Requirement: Editable profile
The system SHALL let the user view and edit every onboarding field at any time from Settings.

#### Scenario: Update height
- **WHEN** the user changes their height in Settings and saves
- **THEN** the new value is used by every subsequent calculation

### Requirement: Unit system preference
The system SHALL store all measurements in metric units and SHALL display and accept input in the user's preferred unit system (metric: kg, cm, km; imperial: lb, ft/in, mi), converting on input and display.

#### Scenario: Imperial input
- **WHEN** a user with imperial preference enters a height of 5 ft 10 in
- **THEN** 177.8 cm is stored and 5 ft 10 in is displayed

#### Scenario: Switching units
- **WHEN** the user switches from metric to imperial
- **THEN** all previously stored values are displayed converted, and no stored value changes

### Requirement: Timezone and day boundaries
The system SHALL assign every dated record to a calendar day computed in the user's timezone, which defaults to the browser-detected timezone at onboarding and falls back to Europe/Copenhagen.

#### Scenario: Late-evening entry
- **WHEN** a user in Europe/Copenhagen records something at 23:30 local time on 18 October (21:30 UTC)
- **THEN** it belongs to 18 October

#### Scenario: Timezone undetectable
- **WHEN** the browser does not report a timezone during onboarding
- **THEN** the timezone defaults to Europe/Copenhagen and is editable

### Requirement: Derived age
The system SHALL calculate the user's age from date of birth on the date of each calculation rather than storing age.

#### Scenario: Birthday passes
- **WHEN** a calculation runs on or after the user's birthday
- **THEN** it uses the incremented age
