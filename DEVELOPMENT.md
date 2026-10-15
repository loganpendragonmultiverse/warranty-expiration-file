# Development record

Version 1.0.0 implements the complete initial scope: local records, explicit status buckets, portable backup, and calendar export. Receipt storage, accounts, remote synchronization, legal interpretation, and notification delivery are excluded.

## 1.1.0 candidate

Import JSON now opens a merge preview before writing anything. It shows counts of new, identical, and conflicting records. Each conflict has keyboard-accessible “Keep current” and “Use backup” radio choices, with “Keep current” selected initially. Existing records absent from the backup are retained; imports never remove them. Choose Apply merge to save, Cancel import to leave records unchanged, or press Escape inside the preview.

Duplicate IDs or malformed backups fail before any write. If browser storage rejects a write, existing in-memory records remain intact and the preview stays available to retry or cancel. Export a backup before making changes; browser storage is still local and can be cleared by browser settings. This adds no accounts, personal-data fields, uploads, or synchronization. Calendar export continues to use the merged records.

Stop at independent PR review before merge or release.
