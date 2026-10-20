# Development record

Version 1.0.0 implements the complete initial scope: local records, explicit status buckets, portable backup, and calendar export. Receipt storage, accounts, remote synchronization, legal interpretation, and notification delivery are excluded.

## 1.1.0 - 2026-10-15

Import JSON now opens a merge preview before writing anything. It shows counts of new, identical, and conflicting records. Each conflict has keyboard-accessible “Keep current” and “Use backup” radio choices, with “Keep current” selected initially. Existing records absent from the backup are retained; imports never remove them. Choose Apply merge to save, Cancel import to leave records unchanged, or press Escape inside the preview.

Duplicate IDs or malformed backups fail before any write. If browser storage rejects a write, existing in-memory records remain intact and the preview stays available to retry or cancel. Export a backup before making changes; browser storage is still local and can be cleared by browser settings. This adds no accounts, personal-data fields, uploads, or synchronization. Calendar export continues to use the merged records.

Changes require independent review before merge or release.

## 1.2.0 completion acceptance

Unreadable storage must remain byte-identical until explicit reviewed recovery;
normal saves and empty exports are blocked, original bytes can be downloaded, and
a valid import requires replacement confirmation. Cross-tab storage drift blocks
stale writes. Synthetic browser tests verify recovery persistence and refusal before
confirmation and exercise all existing merge/race/storage-failure flows unchanged.
Calendar tests cover CR/LF injection, 75-byte UTF-8 folding, UTC DTSTAMP, strict field
types and the final supported calendar date. Run the browser suite in Chromium,
Firefox and WebKit at desktop/narrow widths against source and exact release ZIP.

The release ZIP contains a directly openable `index.html`: CSS and the dependency-free
application modules are inlined at build time, with readable source and license/docs
also included. Extract the ZIP and open index.html while offline. Browser storage and
clipboard access still follow browser policy; if your browser blocks file-origin
storage, serve the extracted folder locally with `python -m http.server 8000` and open
`http://localhost:8000/`. This local server works without an Internet connection.
Release acceptance exercises the actual ZIP's file-protocol entry point and local HTTP
flows, including keyboard controls and exported files.
