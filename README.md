# Warranty Expiration File

Warranty Expiration File is an offline browser application for keeping warranty end dates visible. It stores records only in the current browser, separates active, expiring-soon, and expired items, and exports portable JSON backups and standard calendar events.

Use the [live application](https://loganpendragonmultiverse.github.io/warranty-expiration-file/) or download the self-contained ZIP from the [v1.0.0 release](https://github.com/loganpendragonmultiverse/warranty-expiration-file/releases/tag/v1.0.0).

## Three-minute use

1. Enter an item name and warranty end date.
2. Optionally record purchase date, category, vendor, model, and notes.
3. Filter records by active, expiring within 60 days, or expired.
4. Export JSON for backup or ICS to add the end dates to a calendar.

## Privacy and limitations

There are no accounts, analytics, cookies, or network requests. Browser storage can be cleared by browser settings, private-mode cleanup, device loss, or profile deletion—export backups regularly. Calendar files contain the item details you entered. The app does not store receipts, send notifications itself, interpret warranty terms, provide legal advice, or guarantee that a seller will honor a claim.

## Development

```sh
npm ci
npm test
npm run check
npm run build
```

Node.js 20 or newer is required for development only. See TESTING.md for the automated browser merge checks. Contributions follow [CONTRIBUTING.md](CONTRIBUTING.md), security reports follow [SECURITY.md](SECURITY.md), and the project uses the MIT License.

## More open-source projects

This project is part of the [Logan Pendragon Forge open-source collection](https://www.loganpendragonforge.com/open-source/). Browse the catalog for other released tools, source repositories, live demos, and downloads.

## Preview and merge backups

Import JSON now opens a merge preview before writing anything. It shows counts of new, identical, and conflicting records. Each conflict has keyboard-accessible “Keep current” and “Use backup” radio choices, with “Keep current” selected initially. Existing records absent from the backup are retained; imports never remove them. Choose Apply merge to save, Cancel import to leave records unchanged, or press Escape inside the preview.

Duplicate IDs or malformed backups fail before any write. If browser storage rejects a write, existing in-memory records remain intact and the preview stays available to retry or cancel. Export a backup before making changes; browser storage is still local and can be cleared by browser settings. This adds no accounts, personal-data fields, uploads, or synchronization. Calendar export continues to use the merged records.
