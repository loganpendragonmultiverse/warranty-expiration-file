# Testing

Node >=20 is required; CI uses Node 24.

```sh
npm test
npm run check
npm run build
```

Tests cover malformed/duplicate backups, preview classifications, conflict choices, unchanged records, cancel, failed storage writes, and calendar export.

Browser acceptance: import a synthetic conflict backup; use Tab and arrow keys for conflict choices, Escape to cancel, then apply and reload. Repeat at 390px width, check visible focus and no overflow, and export JSON/ICS. A failed storage write must leave records and preview unchanged. Use synthetic data only.

## Automated browser checks

Install development dependencies with npm ci, then run:

    npx playwright install --with-deps chromium
    npm run test:browser

The Chromium suite uses only intercepted local fixture files, synthetic records and isolated
browser storage. It checks native keyboard radio choices, Escape cancellation, desktop/390px
overflow, persistence across reload, download behavior and failed storage writes.

Deferred File.prototype.text browser regressions cover saves and deletions during import,
overlapping A/B reads after cancellation, and invalidation of previews after record changes.
The tests resolve individual read promises explicitly instead of depending on timing sleeps.
