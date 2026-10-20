# Changelog

## 1.2.0 - 2026-10-20

- Inline the dependency-free app and styles in the release entry point so the extracted ZIP opens offline without blocked module fetches.

- Preserve unreadable saved data, provide an original-data download, and require explicit confirmation before restoring a reviewed valid backup. Block empty exports and normal saves during recovery.
- Refuse stale-tab saves when another tab changes stored records.
- Validate backup field types and calendar date bounds; add creation stamps, CR/LF escaping and UTF-8 folding to ICS exports.
- Expand unit and browser regressions for recovery, concurrent changes and calendar edge cases.

## 1.1.1 - 2026-10-16

- Correct the completed 1.1.0 release wording and dates; feature behavior is unchanged.

## 1.1.0 - 2026-10-15

- Ignore superseded or canceled asynchronous imports and build previews from the latest saved records.

- Replaced destructive backup replacement with a merge preview, explicit conflict choices, cancel, and storage-failure-safe commits. Updated the intended v1.1.0 release ZIP name.

## 1.0.0 - 2026-07-22

- Added local warranty record creation, editing, deletion, and status filters.
- Added schema-versioned JSON backup and replacement import.
- Added standards-based all-day calendar export.
- Added responsive, keyboard-accessible offline interface.
