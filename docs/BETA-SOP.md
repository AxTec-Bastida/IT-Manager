# Team Beta SOP

This SOP is for the controlled Axel + one IT teammate beta. Use the app from:

```text
C:\Dev\warehouse-it-inventory
```

Current Phase 53 beta runtime decision:

- Runtime mode: Windows-native `npm run start` on port `3000`.
- Beta URL / `APP_BASE_URL`: `http://192.168.163.29:3000`.
- Scheduler: Windows Task Scheduler task `Warehouse IT Inventory Jobs` every 15 minutes.
- Docker Compose: supported by the repo, but not selected for this beta machine because Docker CLI/Desktop is not installed or available.
- Do not enable the Docker jobs profile while the Windows Task Scheduler job is active.
- The current real SQLite database is not Prisma-migration-baselined. Do not run `npx prisma migrate deploy` against it during beta until a separate backup-and-baseline plan is approved.

## Daily Use

1. Log in at `http://192.168.163.29:3000/login` while the server is on the same network. If that IP changes, update `.env` and this SOP.
2. Use `/scan` first when an asset label, serial label, QR, barcode, or Data Matrix is available.
3. Search manually if camera access is blocked or the label will not scan.
4. Open the asset detail page before changing anything.
5. Add photos for overview, asset tag, serial label, condition, and installed location when relevant.
6. Create a task for follow-up work instead of hiding uncertainty in notes.
7. Use Move / Relocate for location changes.
8. Use Issue Stock for quantity-based items such as keyboards, mice, cables, chargers, batteries, and printer supplies.
9. Use Intake for new serialized assets or new stock receiving.
10. Use Audits for small physical checks, starting with safe QA assets before real workflows.

## Keep Workflows Separate

- Assignments are long-term responsibility records.
- Asset loans are temporary checkout of serialized equipment.
- Stock issue/loan is for quantity-based consumables and peripherals.
- RMA is for repair batches.
- Decommission is controlled lifecycle removal and should be used carefully.

## Admin Approval Required

Do not do these without Admin approval:

- Bulk intake over 20 items.
- Legacy Excel import.
- Decommission real assets.
- Delete photos or critical records.
- Change settings, users, backups, jobs, or imports.
- Run migrations.
- Run destructive seed/reset commands.

## Backup Rule

Run a backup before:

- Imports.
- Bulk intake.
- Migrations.
- Decommission testing.
- Any major cleanup or data-changing batch.

Command:

```powershell
cd C:\Dev\warehouse-it-inventory
npm run backup
```

Backups must include:

- `prisma/dev.db`
- `uploads/assets`
- `uploads/stock`
- `uploads/facturas`
- `uploads/maps`

## Bug Reports

Include:

- Screenshot.
- Route/page URL.
- Asset tag, stock item, employee, audit, loan, RMA, or task involved.
- What you clicked or scanned.
- Expected result.
- Actual result.
- Date/time.
- Role used: Admin, IT Staff, Auditor, or Viewer.

## Phone Smoke Checklist

1. Open `http://192.168.163.29:3000/login`.
2. Log in as IT Staff.
3. Add to Home Screen if available.
4. Open the installed app.
5. Open `/scan`.
6. Allow camera if the browser permits.
7. Scan a safe label.
8. If camera is blocked, manually search `QA-SMOKE-001`.
9. Open the QA asset.
10. Upload one safe photo using camera or gallery.
11. Confirm thumbnail appears.
12. Confirm no horizontal overflow.
13. Log out.

## Beta Release Checklist

Before beta:

- Git working tree reviewed.
- Latest code pushed to GitHub if that is the team workflow.
- Backup created under `C:\Dev\warehouse-it-inventory\backups`.
- `npm run doctor` has no critical warnings.
- `/api/health` is OK or degraded only for SMTP.
- `npm run jobs:run-due` succeeds.
- Admin user exists.
- IT Staff teammate user exists.
- Server URL works from teammate device.
- Phone login works.
- `QA-SMOKE-001` scan/search works.
- Photo upload works.
- Reports load.

During beta:

- Keep beta to 1-2 users.
- Try QA asset first.
- Run small real workflows only.
- Back up daily.
- Log bugs with the bug report format above.

After beta week:

- Review issues.
- Decide next fixes.
- Expand usage only after the top issues are handled.
