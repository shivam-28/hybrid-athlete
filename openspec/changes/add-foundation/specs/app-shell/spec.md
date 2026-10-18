## Purpose

Provides the installable, phone-first application frame — navigation, Today view and settings — that every feature plugs into.

## ADDED Requirements

### Requirement: Installable web app
The system SHALL be installable to an iPhone home screen and to a desktop browser, launching full-screen without browser chrome and showing the app name and icon.

#### Scenario: Add to iPhone home screen
- **WHEN** the user adds the app to their home screen from Safari and opens it from the icon
- **THEN** it launches in standalone mode with the app icon, name and theme colour, and content is not covered by the status bar or home indicator

### Requirement: Primary navigation
The system SHALL provide persistent navigation to Today, Train, Eat, Body and Coach, positioned for one-handed phone use and adapted for wide screens.

#### Scenario: Phone navigation
- **WHEN** the app is used on a phone-sized screen
- **THEN** a bottom tab bar shows the five sections and highlights the active one

#### Scenario: Desktop navigation
- **WHEN** the app is used on a laptop-sized screen
- **THEN** the same sections are reachable from a side navigation

### Requirement: Today view
The system SHALL show a Today view for the user's current local date as the default signed-in landing page, with an empty-state invitation for each section until features provide content.

#### Scenario: New user lands on Today
- **WHEN** a user who has completed onboarding opens the app
- **THEN** the Today view for their local date is shown with getting-started prompts

### Requirement: Settings
The system SHALL provide a Settings page reachable from every section, giving access to profile, units, timezone, AI key, data export, account deletion, and sign-out.

#### Scenario: Open settings
- **WHEN** the user opens Settings
- **THEN** all listed settings groups are present

### Requirement: Accessible, theme-aware interface
The system SHALL follow the device light/dark preference, support text scaling without loss of content, and give interactive controls touch targets of at least 44×44 points.

#### Scenario: Dark mode device
- **WHEN** the device is in dark mode
- **THEN** the app renders in its dark theme
