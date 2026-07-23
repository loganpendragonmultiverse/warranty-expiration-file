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
npm test
npm run check
npm run build
```

Node.js 20 or newer is required for development only. Version 1.0.0 is feature complete for local records and portable exports. Contributions follow [CONTRIBUTING.md](CONTRIBUTING.md), security reports follow [SECURITY.md](SECURITY.md), and the project uses the MIT License.

## More open-source projects

This project is part of the [Logan Pendragon Forge open-source collection](https://www.loganpendragonforge.com/open-source/). Browse the catalog for other released tools, source repositories, live demos, and downloads.
