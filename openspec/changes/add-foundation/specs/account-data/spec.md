## Purpose

Gives every user full control over their personal health data: a complete portable export and an irreversible deletion of the account.

## ADDED Requirements

### Requirement: Data export
The system SHALL let a user download all of their data as a single machine-readable JSON file containing every user-owned record, with links to download each stored file, and excluding secrets such as their AI key.

#### Scenario: Export
- **WHEN** the user requests an export
- **THEN** they receive a JSON file containing all their records grouped by type, a schema version, and an export timestamp

#### Scenario: Export excludes secrets
- **WHEN** a user with a saved AI key exports their data
- **THEN** the export contains no key material

### Requirement: Account deletion
The system SHALL let a user permanently delete their account after explicit confirmation, removing their authentication identity, every user-owned row, and every stored file.

#### Scenario: Confirmed deletion
- **WHEN** the user confirms deletion by typing the word DELETE
- **THEN** all their rows and stored files are removed, they are signed out, and signing in again with the same email starts a brand-new empty account

#### Scenario: Unconfirmed deletion
- **WHEN** the user cancels or does not type the confirmation word exactly
- **THEN** nothing is deleted

#### Scenario: Deletion leaves other users untouched
- **WHEN** user A deletes their account
- **THEN** no data belonging to user B is affected
