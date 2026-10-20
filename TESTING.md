# Testing

Run these development commands from a source checkout.

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
