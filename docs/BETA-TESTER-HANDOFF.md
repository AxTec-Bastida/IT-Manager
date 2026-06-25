# Beta Tester Handoff

Audience: Warehouse IT beta testers.

## What This App Is For

Warehouse IT Inventory tracks serialized assets, stockroom quantities, labels, assignments, quick asset checkouts, RMA/repair work, facturas, maintenance, reports, audits, photos, backups, scheduled checks, and Data Quality review.

Beta URL:

```text
https://warehouse-it.local
```

Use the same URL consistently. Switching between hostname, LAN IP, and localhost creates different browser sessions, camera permissions, and offline storage.

## What To Test

- Quick Scan: scan an asset tag, barcode, QR code, serial, or stock code.
- Photo: capture an asset photo and try the upload fallback.
- Add One Asset.
- Bulk Receive Serialized Assets.
- Pair Companion Devices.
- Stockroom: add stock, restock, physical count, issue/loan item.
- Labels: preview/generate/download labels.
- Asset Assignment.
- Quick Asset Checkout.
- RMA / Repair.
- Facturas and factura lifecycle.
- Maintenance, including printer page counts and scale maintenance review.
- Reports and Data Quality review.

## What Not To Do

- Do not upload real sensitive facturas unless approved.
- Do not enter real BitLocker keys until the vault secret is approved and stored in the approved password manager.
- Do not create fake production assignments unless clearly marked as test data.
- Do not casually export or share sensitive data.
- Do not store passwords, tokens, SMTP credentials, printer credentials, or recovery keys in notes.

## How To Report Bugs

Include:

- Steps to reproduce.
- Expected result.
- Actual result.
- Device/browser.
- Route/page.
- Asset tag, stock code, or test record if safe.
- Screenshot only if it contains no sensitive data.

Use the bug table in `docs/BETA-PUNCHLIST.md`.

## Known Limitations

- No UniFi integration.
- No live SNMP printer polling.
- No OCR expansion.
- No direct Zebra network printing.
- No fingerprint/thumb scanning.
- No broad purchasing app integration.
- No wider rollout until manual blockers are closed.

## Emergency Rollback

Stop the app, preserve the current database/uploads, and follow the restore procedure in `docs/BETA-SOP.md`. Do not run `prisma migrate reset`. Use the latest verified backup and restore to a separate folder first when possible.

