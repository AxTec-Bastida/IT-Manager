# Warehouse IT Inventory User Manual

This manual explains the daily tools in the Warehouse IT Inventory app. It is written for warehouse IT users working from a phone, scanner, or PC.

Project stewardship: built and handed off by Alejandro Bastida / AxTec Bastida. Source repository: https://github.com/AxTec-Bastida/IT-Manager

Do not store passwords, SMTP credentials, BitLocker recovery keys, API keys, or private notes in normal records, labels, tasks, or resources.

Language note: the app supports English and Spanish. Use the language switcher in the sidebar or mobile drawer. The Spanish manual is maintained separately in `docs/MANUAL-DE-USUARIO.md`.

## 1. Navigation And Daily Start

![Navigation overview](/manual/user/01-navigation.svg)

Start from:

- Dashboard: daily status and shortcuts.
- Quick Scan: fastest way to find records and act.
- Inventory: browse assets by category or workflow.
- Workspace: tasks, resources, PO tracker, offline queue, reports, and conflicts.

Use the side menu or phone drawer to reach deeper tools. If a page asks for credentials unexpectedly, sign in again and tell an admin; sessions should normally persist.

## 2. Quick Scan

![Quick Scan workflow](/manual/user/02-quick-scan.svg)

Use Quick Scan when you have:

- asset tag
- serial number
- barcode or QR label
- employee ID or name
- stock code
- temporary borrower ID
- legacy alias

After a match, review the result and choose the correct action: open asset, assign, return, loan, RMA, move, add photo, issue stock, or open borrower.

## 3. Inventory And Asset Browsing

![Inventory workflow](/manual/user/03-inventory.svg)

Inventory is not meant to be a raw spreadsheet. Use category and workflow views:

- Laptops / desktops
- Mobile devices
- Printers
- Scales
- Scanners
- Network / static assets
- Assigned
- Loaned
- In RMA
- Needs Review
- Missing Photos

Open the asset detail page to see current status, photos, labels, assignment history, loan history, RMA history, factura links, asset value, and activity.

## 4. Inventory Intake And Labels

![Intake and labels workflow](/manual/user/04-intake-labels.svg)

Use Intake for new inventory:

- Single Asset Intake: one serialized device.
- Bulk Asset Intake: generated ranges such as `J001-J100` or `Zebra-208-Zebra-250`.
- Stock Intake: generic quantity-based consumables and peripherals.

Use Labels to generate QR/barcode labels. Labels encode asset tags only by default. Serial codes are optional and separate. Never encode secrets, employee data, factura details, or recovery keys.

## 5. Assignments, Asset Loans, And Stock Issues

![Responsibility workflow](/manual/user/05-responsibility.svg)

Use the correct workflow:

- Assignment: long-term employee responsibility for serialized equipment.
- Asset Loan: temporary checkout of serialized equipment with an expected return date.
- Stock Issue: generic quantity-based handout or loan.
- Temporary Borrower: contractor, visitor, or person not yet in Employees.

Assignment history, loan history, stock issue history, and activity logs should be preserved.

## 6. RMA, Repair, And Maintenance

![Repair and maintenance workflow](/manual/user/06-repair-maintenance.svg)

RMA / Repair:

- Create a case.
- Add devices.
- Send the batch.
- Receive returned devices as repaired, replaced, rejected, lost, retired, or returned as-is.

Maintenance:

- Record printer cleaning, supplies, and service.
- Record scale checks and service.
- Use alerts for due dates.

The current app does not do SNMP or printer polling.

## 7. Photos, Data Quality, And Cleanup

![Compliance workflow](/manual/user/07-compliance.svg)

Photos help prove asset identity and condition. Recommended photo types include:

- overview
- asset tag
- serial label
- condition
- damage
- installed location for fixed assets

Use Data Quality for:

- duplicate IP review
- missing fields
- suspicious imported names
- suspicious stock/comment rows
- mobile/sled pairing review
- missing required photos
- orphaned workflow states

Do not auto-fix ambiguous data. Open the record, review, then apply only safe actions.

## 8. Facturas, Line Items, And Asset Value

![Factura and asset value workflow](/manual/user/08-facturas-values.svg)

Facturas store purchase records and files. Use extraction tools as helpers, then review line items before applying values.

Use factura and asset value tools for:

- purchase documents
- line item review
- asset links
- stock links
- cost tracking
- warranty dates
- depreciation / lifecycle information

Do not overwrite values blindly.

## 9. Physical Audits And Offline Queue

![Audit and offline workflow](/manual/user/09-audits-offline.svg)

Physical audits record observations:

- expected assets
- found assets
- missing assets
- wrong area assets
- unknown labels
- duplicate scans
- needs review

Exports and tasks help follow up after an audit.

Offline Queue supports limited offline work such as scans, moves, and asset photo upload queue. If the browser clears local storage before a photo syncs, the app creates a conflict and the photo may need to be retaken.

## 10. Alerts, Tasks, Jobs, Backups, And Admin Areas

![Alerts and admin workflow](/manual/user/10-alerts-admin.svg)

Alerts show operational issues:

- low stock
- overdue asset loans
- overdue stock loans
- RMA follow-up
- printer or scale maintenance due
- warranty expiration
- data quality warnings

Tasks are for follow-up work and accountability.

Admins manage:

- users and roles
- settings
- email notifications
- scheduled jobs
- backups
- data quality actions
- imports
- BitLocker vault access

Backups must include:

- `prisma/dev.db`
- `uploads/assets`
- `uploads/facturas`

## Handoff Notes

This app is the source of truth. Excel is legacy reference only unless an admin intentionally runs a controlled import.

Prefer safe lifecycle actions over deletion:

- return
- close
- archive
- deactivate
- mark reviewed
- create task

Future code changes, new workflows, deployment help, production support, or recovery assistance should be handled as paid support/change work by the app maintainer.
