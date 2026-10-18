## Purpose

Lets users keep private, dated progress photos by pose and compare them over time, with optional consented AI observations that never pose as measurements.

## ADDED Requirements

### Requirement: Upload progress photos
The system SHALL let a user upload a progress photo (JPEG, PNG or HEIC, up to 15 MB) with a date (default today in the user's timezone) and a pose of front, side or back.

#### Scenario: Upload a front photo
- **WHEN** a user uploads a front photo dated today
- **THEN** the photo is stored and appears in the gallery under today's date and pose front

#### Scenario: Missing pose
- **WHEN** a user uploads a photo without selecting a pose
- **THEN** the upload is rejected with a message asking for a pose

### Requirement: Metadata stripping
The system SHALL remove all EXIF and embedded metadata, including GPS location and device identifiers, from progress photos and body composition report images before they are persisted, while preserving the visual orientation.

#### Scenario: GPS removed
- **WHEN** a user uploads a photo containing GPS coordinates in its EXIF data
- **THEN** the stored file contains no GPS or other EXIF metadata

#### Scenario: Orientation preserved
- **WHEN** a photo taken in portrait has an EXIF orientation tag
- **THEN** the stored photo displays upright without the tag

### Requirement: Owner-only private access
The system SHALL store progress photos in private storage, SHALL serve them only to their owner through links that expire within 10 minutes, and SHALL deny access to any other user or unauthenticated request.

#### Scenario: Other user denied
- **WHEN** a signed-in user requests another user's photo
- **THEN** the request is denied and no image data is returned

#### Scenario: Expired link
- **WHEN** a photo link is used more than 10 minutes after it was issued
- **THEN** the image is not served

### Requirement: Photo comparison
The system SHALL let a user pick two dates and a pose and display the two photos side by side with their dates, the days between them, and the daily weight on each date when available.

#### Scenario: Compare front photos
- **WHEN** a user compares front photos from 2026-08-01 and 2026-10-01
- **THEN** both photos are shown side by side labelled with their dates, "61 days apart", and each day's weight if recorded

### Requirement: AI analysis consent
The system SHALL keep progress photo AI analysis disabled by default and SHALL enable it only after the user explicitly opts in on a screen stating that photos will be sent to Anthropic using their own API key; the user SHALL be able to withdraw consent at any time.

#### Scenario: Analysis blocked without consent
- **WHEN** a user who has not opted in requests AI analysis
- **THEN** no photo is sent to the AI provider and the consent screen is shown

#### Scenario: Withdraw consent
- **WHEN** a user withdraws consent
- **THEN** subsequent analysis requests are blocked until they opt in again

### Requirement: Qualitative AI analysis
The system SHALL, for a consented user with an AI key, return qualitative observations comparing two same-pose photos (visible changes in definition, shape and posture) and SHALL NOT store, chart or pass to any calculation a body-fat figure derived from photos; any range mentioned SHALL be labelled "visual impression, not a measurement".

#### Scenario: Comparison analysis
- **WHEN** a consented user requests analysis of front photos from two dates
- **THEN** a short qualitative comparison is shown and saved with the photo pair

#### Scenario: No body fat measurement from photos
- **WHEN** the AI response includes a body fat range
- **THEN** it is shown only with the label "visual impression, not a measurement" and does not appear in body composition data or nutrition calculations

### Requirement: Delete progress photos
The system SHALL let a user delete a progress photo, removing the stored file and any analysis that references it.

#### Scenario: Delete photo
- **WHEN** a user deletes a photo
- **THEN** it disappears from the gallery, its file is removed from storage, and analyses referencing it are deleted
