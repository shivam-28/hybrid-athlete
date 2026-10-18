## Purpose

Lets a person sign in with their email address and guarantees that each user can only ever read or change their own health data.

## ADDED Requirements

### Requirement: Passwordless email sign-in
The system SHALL let a user sign in by entering an email address and then either following a one-time link or typing a one-time 6-digit code, both delivered in the same email; no passwords are stored.

#### Scenario: Successful sign-in with link
- **WHEN** a user requests sign-in for an allowed email address and opens the link within its validity period
- **THEN** the user is signed in and redirected to onboarding if their profile is incomplete, otherwise to the Today view

#### Scenario: Sign-in with code from the installed iPhone app
- **WHEN** a user signs in from the home-screen app, which does not share sessions with Safari, and types the 6-digit code from the email
- **THEN** the user is signed in inside the home-screen app itself

#### Scenario: Wrong code
- **WHEN** the user enters an incorrect code
- **THEN** the user is not signed in and may retry or request a new email

#### Scenario: Expired or reused link
- **WHEN** a user opens a sign-in link that has expired or was already used
- **THEN** the user is not signed in and sees a message offering to send a new link

### Requirement: Signup allowlist
The system SHALL restrict new account creation to the email addresses or domains in the instance's signup allowlist when the allowlist has entries, SHALL allow any email address when it is empty, and MUST enforce this in the authentication service itself so that it cannot be bypassed by calling the authentication API directly.

#### Scenario: Email not on the allowlist
- **WHEN** the allowlist has entries and a new email address that matches no entry requests a sign-in link
- **THEN** no account is created and the user sees a neutral message that the instance is invite-only

#### Scenario: Existing user after allowlist change
- **WHEN** an existing user's email address is removed from the allowlist
- **THEN** that user can still sign in, because the allowlist only gates account creation

#### Scenario: No allowlist configured
- **WHEN** the allowlist is empty and any email address requests a sign-in link
- **THEN** the sign-in link is sent

### Requirement: Protected application routes
The system SHALL require an authenticated session for every application page and API endpoint except the landing page, sign-in pages, and endpoints that use their own token authentication.

#### Scenario: Anonymous access to an app page
- **WHEN** a visitor without a session opens any application page
- **THEN** they are redirected to the sign-in page and returned to the requested page after signing in

#### Scenario: Anonymous API call
- **WHEN** a request without a valid session calls a session-protected API endpoint
- **THEN** the endpoint responds with HTTP 401 and no data

### Requirement: Per-user data isolation
The system MUST ensure a user can read, create, update, or delete only rows and stored files they own, enforced by the database and storage layer rather than by application code alone.

#### Scenario: Reading another user's data
- **WHEN** an authenticated user queries any user-owned table or storage path belonging to a different user, including by guessing identifiers
- **THEN** no rows or files are returned and no error reveals that they exist

#### Scenario: Writing on behalf of another user
- **WHEN** an authenticated user attempts to insert or update a row with another user's identifier as owner
- **THEN** the write is rejected

### Requirement: Sign-out
The system SHALL let a signed-in user sign out, ending the session on that device.

#### Scenario: Sign out
- **WHEN** the user selects sign out
- **THEN** the session is cleared and the user is returned to the sign-in page
