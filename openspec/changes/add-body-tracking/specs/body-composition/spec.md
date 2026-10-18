## Purpose

Captures measured body composition (body fat %, lean mass, muscle mass and related values) from manual entry or AI-read test reports, so nutrition and coaching use real measurements rather than guesses.

## ADDED Requirements

### Requirement: Manual body composition entry
The system SHALL let a user record a body composition test manually with a test date, a measurement method (InBody, Tanita, DEXA, Withings, other bioimpedance, skinfold, other) and any subset of: weight, body fat %, fat mass, skeletal muscle mass, lean (fat-free) mass, visceral fat level, device-reported BMR, total body water, and segmental lean mass (left/right arm, trunk, left/right leg); manual entry SHALL work without an AI key.

#### Scenario: Manual entry without AI key
- **WHEN** a user without a stored AI key enters a DEXA test dated 2026-10-01 with weight 79.0 kg and body fat 18.5 %
- **THEN** the test is saved with method DEXA and those values

#### Scenario: Method is required
- **WHEN** a user submits a test without a measurement method
- **THEN** the submission is rejected with a validation message

### Requirement: Body composition document upload and extraction
The system SHALL let a user upload a body composition report as an image (JPEG, PNG, HEIC) or PDF up to 10 MB, store the original in private owner-only storage, and, when the user has an AI key, extract the fields listed in the manual entry requirement plus test date and method into a pre-filled confirmation form where each field is either a value or explicitly marked "not found".

#### Scenario: InBody photo extracted
- **WHEN** a user with an AI key uploads a photo of an InBody 570 printout
- **THEN** the confirmation form is pre-filled with the values read from the printout, method InBody, the printed test date, and unreadable fields marked "not found"

#### Scenario: No AI key
- **WHEN** a user without an AI key uploads a report
- **THEN** the file is stored, the user is told extraction requires an AI key, and an empty manual form linked to the file is shown

#### Scenario: Unsupported file
- **WHEN** a user uploads a 15 MB file or a .docx file
- **THEN** the upload is rejected with a message stating the allowed types and size

#### Scenario: Not a body composition report
- **WHEN** the uploaded image contains no recognisable body composition data
- **THEN** the user is told no values were found and offered the manual form; nothing is saved

### Requirement: Confirmation before saving extracted values
The system SHALL NOT persist AI-extracted body composition values until the user confirms the form, and SHALL let the user edit any field, fill "not found" fields, or discard the extraction.

#### Scenario: User corrects a value
- **WHEN** the extraction reads body fat 81.5 % and the user corrects it to 18.5 % and confirms
- **THEN** the saved test has body fat 18.5 %

#### Scenario: User discards
- **WHEN** the user discards the extraction
- **THEN** no test is saved and the uploaded file is deleted

### Requirement: Consistency checks
The system SHALL flag, before confirmation, any test where body fat % is outside 3–60 %, where fat mass plus lean mass differs from weight by more than 2 %, or where body fat % differs from fat mass divided by weight by more than 1 percentage point; flagged values SHALL be highlighted and the user SHALL still be able to confirm them.

#### Scenario: Masses do not add up
- **WHEN** a test has weight 80.0 kg, fat mass 15.0 kg and lean mass 60.0 kg
- **THEN** a warning states that fat mass plus lean mass (75.0 kg) differs from weight by more than 2 %

#### Scenario: Consistent test
- **WHEN** a test has weight 80.0 kg, fat mass 16.0 kg, lean mass 64.0 kg and body fat 20.0 %
- **THEN** no consistency warnings are shown

### Requirement: Derived values
The system SHALL derive missing values when the others are present: lean mass = weight − fat mass, fat mass = weight × body fat % / 100, and body fat % = fat mass / weight × 100, and SHALL mark derived values as derived.

#### Scenario: Lean mass derived
- **WHEN** a confirmed test has weight 80.0 kg and body fat 20.0 % but no fat or lean mass
- **THEN** fat mass 16.0 kg and lean mass 64.0 kg are stored and marked derived

### Requirement: Method-aware trends
The system SHALL chart body fat %, lean mass and skeletal muscle mass over time with each point labelled by method, SHALL draw trend lines only between tests of the same method, and SHALL warn when the two most recent tests use different methods.

#### Scenario: Mixed methods
- **WHEN** a user's last two tests are InBody (21 %) and DEXA (24 %)
- **THEN** the chart shows both points with their method and a notice that results from different methods are not directly comparable

### Requirement: Latest body composition for downstream use
The system SHALL expose, per user, the most recent confirmed test that contains body fat % (with its date, method, body fat % and lean mass) as the source of body composition for other features, and SHALL report none when no such test exists.

#### Scenario: Latest test selected
- **WHEN** a user has confirmed tests on 2026-08-01 (19 %) and 2026-10-01 (18 %)
- **THEN** the latest body composition is the 2026-10-01 test with 18 %

#### Scenario: No tests
- **WHEN** a user has no confirmed test with body fat %
- **THEN** downstream features are told no body composition is available

### Requirement: Edit and delete tests
The system SHALL let a user edit or delete their confirmed tests; deleting a test SHALL delete its stored report file.

#### Scenario: Delete with file
- **WHEN** a user deletes a test that has an uploaded report
- **THEN** the test and the report file are removed and the file is no longer retrievable
