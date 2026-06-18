# Team Beta SOP

This SOP is for the controlled Axel + one IT teammate beta. Use the app from:

```text
C:\Dev\warehouse-it-inventory
```

Current Phase 53 beta runtime decision:

- Runtime mode: Windows-native `npm run start` on port `3000`.
- Beta URL / `APP_BASE_URL`: `http://192.168.0.67:3000`.
- Scheduler: Windows Task Scheduler task `Warehouse IT Inventory Jobs` every 15 minutes.
- Docker Compose: supported by the repo, but not selected for this beta machine because Docker CLI/Desktop is not installed or available.
- Do not enable the Docker jobs profile while the Windows Task Scheduler job is active.
- Phase 54 baselined the current real SQLite database into Prisma migration metadata. Future schema migrations can use `npx prisma migrate deploy` after a backup.
- SMTP is optional and currently pending unless `.env` has real company SMTP values. Without SMTP, records still save and email attempts are logged as skipped.

## Controlled Team Beta Status

Final Phase 69 readiness verdict: controlled beta is ready for Axel plus one IT teammate, not broad production V1.

Phase 70 restore drill verdict: full restore drill passed in a separate folder and confirmed the backup can restore database, uploads, factura files, BitLocker encrypted QA records, migrations, build output, runtime health, and backup-from-restore without overwriting the live app.

Ready for beta:

- Windows-native runtime from `C:\Dev\warehouse-it-inventory`.
- Backups, health/doctor, scheduled jobs, auth/roles, inventory, scan/manual fallback, intake, assignments, loans, stock, RMA, audits, labels, maps, reports, Data Quality, factura extraction/line items, asset values, decommission, and BitLocker vault.
- Offline Queue foundation for safe QA test notes, serialized asset moves, and asset photo uploads only. Stock, RMA, decommission, BitLocker, factura, admin, import, bulk intake, and stock photos remain online-only.
- Offline asset photos are browser/device-local until sync. Do not clear browser data, uninstall the PWA, or switch devices before syncing queued photos.
- Daily beta checks: `npm run backup`, `npm run doctor`, `npm run jobs:run-due`, and `/api/health`.

Pending before wider rollout:

- Configure and validate SMTP with a QA recipient before sending real receipts.
- Complete trusted HTTPS/local CA setup on the real phone before relying on live camera/PWA install.
- Store `BITLOCKER_VAULT_SECRET` in the approved password manager before real recovery keys are entered.
- Repeat full restore drills periodically and before expanding to more users.
- Validate Docker only if Docker becomes the selected runtime; do not run Docker jobs while Windows Task Scheduler is active.

Do not do during beta:

- Do not run `prisma migrate reset`, destructive seed, broad import, broad cleanup, OCR expansion, SNMP polling, UniFi work, direct Zebra sending, or public tunnels.
- Do not commit `.env`, SMTP credentials, `BITLOCKER_VAULT_SECRET`, BitLocker recovery keys, database files, uploads, backups, certificates, private keys, or logs.

QA records:

- `QA-*` assets, `QA-PHASE-*` facturas, and `QA Smoke Mouse` are controlled test evidence. Keep them clearly labeled and do not count them as production assets in manual reviews.

Current Phase 55 phone beta status:

- Server-side LAN checks passed for `/api/health`, `/login`, `/scan`, `/devices`, `/reports`, `/photos/compliance`, and `/map`.
- PWA manifest is available and includes PNG icons plus the SVG icon.
- Camera scan UI includes live camera, scan-from-photo, and manual input fallbacks.
- Asset photo UI includes camera capture, gallery fallback, preview, retake/choose again, progress, thumbnail display, and full-image open links.
- Real teammate phone/PWA install/camera permission still must be confirmed on the physical device and browser used for beta.
- If phone camera is blocked on `http://192.168.0.67:3000`, use manual scan or scan-from-photo/gallery upload and plan HTTPS/trusted-origin setup as a future hardening task.

Current Phase 62 HTTPS/trusted-origin runtime:

- Preferred beta URL / `APP_BASE_URL`: `https://warehouse-it.local`.
- Local runtime path for reviewed Caddy binary/config: `C:\Tools\caddy`.
- Server hosts-file test entry: `127.0.0.1 warehouse-it.local`.
- Plain HTTP LAN URLs can block or destabilize phone camera, barcode scanning, photo capture, and PWA install.
- Recommended beta path is LAN-only HTTPS through Caddy reverse proxy to `127.0.0.1:3000`.
- Alternate path is mkcert plus an approved local HTTPS reverse proxy.
- Do not expose the app publicly, port-forward it, or publish tunnel URLs during beta.
- Do not commit generated certificates, private keys, local CA files, `.env`, uploads, backups, or database files.
- Keep `http://192.168.0.67:3000` only as fallback if Caddy/certificate trust needs repair.
- Current server-side HTTPS proxy validation passed with `curl.exe -k`; local browser/phone trust still requires installing the Caddy local CA on the test device before real camera/PWA validation.
- Caddy must forward the public host/proto headers. Phase 76 found and fixed a bad login redirect where the app sent HTTPS users to `https://localhost:3000/dashboard` instead of `https://warehouse-it.local/dashboard`.

Current Phase 76 real-phone validation status:

- Server-side HTTPS runtime validation passed for `https://warehouse-it.local`.
- Authenticated HTTPS checks passed for `/dashboard`, `/scan`, `/offline`, `/offline/conflicts`, `/offline/move`, `/data-quality`, and QA asset detail.
- `TEST_OFFLINE_NOTE`, `MOVE_ASSET`, and `UPLOAD_ASSET_PHOTO` synced successfully through the HTTPS runtime using QA asset `QA-PHONE-FIELD-001`.
- The QA offline move changed only the QA asset location to `QA / Phone / Bench 76`.
- The QA offline photo used a harmless generated PNG; its original and thumbnail opened from `/uploads/assets`.
- Missing browser photo blob behavior created a reviewed conflict saying `Local photo file is no longer available. Retake the photo.` and did not create a broken photo record.
- Physical phone model/browser, certificate trust, live camera, PWA install, and close/reopen persistence remain pending until the actual beta phone is tested.

## Migration Safety

Prisma `P3005` means Prisma sees a non-empty database without migration metadata. Do not run `prisma migrate reset` on real data.

For a copied or existing real database that needs baselining:

```powershell
cd C:\Dev\warehouse-it-inventory
npm run backup
copy prisma\dev.db prisma\dev.before-baseline.YYYYMMDD-HHMMSS.db
npm run db:baseline:dry-run
$env:CONFIRM_DB_BASELINE="true"
npm run db:baseline:apply -- --confirm
Remove-Item Env:\CONFIRM_DB_BASELINE
npx prisma migrate status
npx prisma migrate deploy
```

For normal production updates after the Phase 54 baseline:

1. Back up.
2. Pull code.
3. Run `npm install`.
4. Run `npx prisma migrate deploy`.
5. Run `npx prisma generate`.
6. Run `npm run doctor`.
7. Run `npm run build`.
8. Restart the app.
9. Check `/api/health`.

## Daily Use

1. Log in at `https://warehouse-it.local/login` while the server is on the same trusted network. Use `http://192.168.0.67:3000/login` only as a fallback if Caddy/certificate trust needs repair.
2. Use `/scan` first when an asset label, serial label, QR, barcode, or Data Matrix is available.
3. Search manually if camera access is blocked or the label will not scan.
4. Open the asset detail page before changing anything.
5. Add photos for overview, asset tag, serial label, condition, and installed location when relevant.
6. Create a task for follow-up work instead of hiding uncertainty in notes.
7. Use Move / Relocate for location changes.
8. Use Issue Stock for quantity-based items such as keyboards, mice, cables, chargers, batteries, and printer supplies.
9. Use Intake for new serialized assets or new stock receiving.
10. Use Audits for small physical checks, starting with safe QA assets before real workflows.

## Offline Queue Foundation

Phase 71 added `/offline` as a local action queue foundation. Phase 72 enables serialized asset moves as the first real offline workflow, Phase 74 enables asset photo uploads, and Phase 75 hardens mobile storage safety.

Current allowed offline actions:

- `TEST_OFFLINE_NOTE`, a harmless note used to prove local queue persistence, sync, status transitions, failure handling, and server audit records.
- `MOVE_ASSET`, a serialized asset relocation request with asset tag/device ID, destination, notes, and last-known status/assignment/map-anchor values.
- `UPLOAD_ASSET_PHOTO`, an asset photo captured from an asset detail page. The queue stores safe metadata in localStorage and keeps the photo blob in browser IndexedDB until sync or cancellation.

Rules:

- Users must still log in before sync.
- The server validates every synced action and never trusts the local queue blindly.
- Offline asset moves require `inventory.write` at sync time and are applied only if the asset, destination, and last-known state are still safe.
- Offline asset photo sync requires `inventory.write`, a matching local IndexedDB photo blob, a valid asset, and a supported image type/size. If the blob is gone or the asset was retired/disposed, the app creates a conflict instead of uploading.
- `/offline` shows a storage safety card with queued photo count, queued photo size, and browser storage estimate when available.
- Clear synced removes synced queue metadata and synced photo blobs. Cancelling a queued pending photo asks for confirmation and removes that browser-local blob.
- Unsupported action types fail or conflict clearly until later phases implement them.
- Do not queue or paste BitLocker keys, passwords, SMTP values, private keys, factura files, PDFs, or sensitive notes.
- Do not rely on offline mode for stock issue, stock photo upload, RMA receive, decommission, factura extraction, admin/users/settings, imports, bulk intake, or BitLocker workflows.
- Conflicts and failed syncs require manual review. The app does not auto-resolve conflicts or apply stale/unsafe offline moves.
- Review failed or conflicted sync records at `/offline/conflicts`. Admin and IT Staff can retry, cancel, or mark reviewed with a note; Auditors can read sanitized records when audit access is available.
- Data Quality shows Offline Sync Health so daily beta review can catch failed/conflicted browser-queued actions quickly.

Offline move workflow:

1. Open `/offline/move`, Quick Scan, or an asset detail page.
2. Queue the serialized asset move with a destination.
3. Return to `/offline` and tap Sync now when online.
4. Open `/offline/conflicts` if any sync fails or conflicts.
5. Review conflicts before retrying. Retry runs the same server validation again; cancel does not apply the action; mark reviewed keeps the audit trail. Do not use offline mode to move real assets unless the destination is intentional and safe.

Offline asset photo workflow:

1. Open an asset detail page and use the Photos section.
2. Capture or choose a photo, set the photo type/caption/primary flag, then tap Queue offline.
3. Keep the same browser/device until sync because the photo blob lives only in that browser's IndexedDB.
4. Return to `/offline` and tap Sync now when online.
5. Review `/offline/conflicts` if sync reports a missing blob, missing asset, retired/disposed asset, permission problem, or invalid file.
6. If the browser-local photo blob is missing because storage was cleared, retake the photo. The server cannot recover the original image from queue metadata.

Daily offline beta checklist:

1. Open `/offline`.
2. Sync pending actions before switching devices or clearing browser data.
3. Review `/offline/conflicts`.
4. Check Data Quality Offline Sync Health.
5. Cancel or mark reviewed any stale missing-blob photo conflicts after retaking the photo.

Roadmap:

- Phase 72: Offline Scan + Move Queue completed for serialized asset movement.
- Phase 73: Offline Conflict Review Center completed for failed/conflicted test notes and serialized asset moves.
- Phase 74: Offline Photo Upload Queue completed for asset photos only.
- Phase 75: Offline Mobile Field Test + Storage Safety Polish completed for browser-local storage warnings, synced blob cleanup, missing-blob failure handling, and mobile-width offline review.

## SMTP / Email Validation

Manual email receipts are available for assignments, asset loans, stock issues, and RMA records after SMTP is configured. Email is attempted after the record is saved; a failed email must not undo the saved workflow.

Configure SMTP only in the local `.env` file and never commit credentials:

```powershell
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
MAIL_FROM=
APP_BASE_URL=http://192.168.0.67:3000
```

Use `SMTP_FROM` for the sender address. `MAIL_FROM` is accepted as a fallback for older local setup notes. If the company SMTP relay does not require authentication, leave both `SMTP_USER` and `SMTP_PASS` blank; otherwise set both. Do not set only one.

Validation steps:

1. Run `npm run doctor` and confirm SMTP only warns when intentionally not configured.
2. Open `/settings` as Admin.
3. Confirm the SMTP status shows only sanitized fields: configured, host present, from present, port, secure mode, auth present, and `APP_BASE_URL`.
4. Send a test email only to a QA recipient first.
5. Confirm links in the email use `http://192.168.0.67:3000`, not localhost.
6. If sending fails, check SMTP host, port, secure mode, credentials, and company firewall/network rules. Common ports are `587` STARTTLS, `465` SSL, and `25` internal relay.

Do not send real employee receipts until the QA test email and one safe workflow receipt have been reviewed.

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

If BitLocker vault records exist, the database backup contains encrypted recovery-key payloads only. The matching `BITLOCKER_VAULT_SECRET` is not included in backups and must be stored in the company-approved password manager. Losing that secret means restored BitLocker recovery keys cannot be decrypted.

## Full Restore Drill / Disaster Recovery

Latest validated restore drill:

- Phase: 70.
- Source backup: `C:\Dev\warehouse-it-inventory\backups\manual-20260617-212205`.
- Restore folder: `C:\Dev\warehouse-it-inventory-restore-test-phase70`.
- Restore runtime: `http://127.0.0.1:3015`.
- Restore backup produced: `C:\Dev\warehouse-it-inventory-restore-test-phase70\backups\manual-20260617-213002`.
- `npx prisma migrate status`: database schema was up to date.
- `npx prisma migrate deploy`: no pending migrations.
- `npx prisma generate`: passed.
- `npm run doctor`: passed with expected restore-only warnings for SMTP and local app base URL.
- `npm run build`: passed.
- `/api/health`: reachable; degraded only for restore-only SMTP/app-base-url warnings.
- Upload serving: restored asset photos and factura PDFs opened with expected content types; missing and traversal paths returned 404.
- BitLocker vault: encrypted QA key restored, Admin reveal worked with the matching `BITLOCKER_VAULT_SECRET`, IT/Viewer reveal was denied, and no plaintext key appeared in stored encrypted payloads.
- Restore-only QA users/sessions were removed after validation.

Restore steps for a real incident:

1. Stop the affected app/server.
2. Back up the broken/current state first if possible.
3. Create a separate restore folder. Do not overwrite `C:\Dev\warehouse-it-inventory` until the restored copy has been validated.
4. Restore the matching `prisma/dev.db` and upload folders from one backup set.
5. Restore local `.env` values, including the matching `BITLOCKER_VAULT_SECRET` from the approved password manager. Never print or commit secrets.
6. Run `npm install`.
7. Run `npx prisma migrate status`.
8. Run `npx prisma migrate deploy`.
9. Run `npx prisma generate`.
10. Run `npm run doctor`.
11. Run `npm run build`.
12. Start the app on a separate test port and check `/api/health`.
13. Verify login, representative asset pages, photos, stock/factura files, reports, scheduled jobs status, and BitLocker role behavior if vault records exist.
14. Run `npm run backup` from the restored folder and confirm the new backup is written under the restored folder.
15. Only after Admin review should restored database/uploads be promoted back to the live app folder.

Never use `prisma migrate reset`, destructive seed, workbook import, or broad cleanup scripts as a disaster recovery shortcut.

## BitLocker Vault Rule

Use the BitLocker vault only for fake QA keys or approved production recovery keys. Never paste recovery keys into notes, tasks, ActivityLog details, emails, reports, QR labels, or exports.

- `BITLOCKER_VAULT_SECRET` must be configured before creating or revealing keys.
- Admin users can reveal keys after a deliberate click.
- IT Staff can add/update vault records during beta but cannot reveal keys.
- Auditor/Viewer roles must not see plaintext keys.
- Every create/update/reveal/copy action is audited without plaintext key data.
- Before restore testing, confirm the restored `.env` has the same vault secret used when the keys were encrypted.

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

1. Prefer the approved HTTPS beta URL, for example `https://warehouse-it.local/login`. Use `http://192.168.0.67:3000/login` only as a fallback while HTTPS is not ready.
2. Log in as IT Staff.
3. Record the device/browser, for example iPhone Safari, Android Chrome, or Zebra/warehouse device browser.
4. Confirm the certificate is trusted. Do not bypass certificate warnings for real beta users unless Admin explicitly accepts that risk.
5. Add to Home Screen / Install App if available.
6. Open the installed app.
7. Confirm bottom nav and More drawer open/close.
8. Open `/scan`.
9. Allow camera if prompted.
10. Scan a safe label.
11. If camera is blocked, manually search `QA-SMOKE-001` or use scan-from-photo.
12. Open the QA asset.
13. Upload one safe photo using camera or gallery.
14. Confirm thumbnail appears and the full image opens.
15. Check `/devices`, `/intake`, `/stock`, `/tasks`, `/reports`, `/photos/compliance`, and `/map` for horizontal overflow.
16. Log out.

## HTTPS Setup Runbook

Recommended: Caddy reverse proxy.

1. Keep the app on Windows-native `npm run start` at port `3000`.
2. Configure Caddy with a reviewed local Caddyfile:

   ```text
   {
     skip_install_trust
   }

   https://warehouse-it.local {
     tls internal
     reverse_proxy 127.0.0.1:3000
   }
   ```

3. Make `warehouse-it.local` resolve to the server IP through local DNS or hosts-file testing.
4. `tls internal` uses Caddy's local CA. `skip_install_trust` prevents hidden startup prompts; trust the Caddy local CA/certificate on the test phone before relying on camera/PWA testing.
5. Set `APP_BASE_URL=https://warehouse-it.local` in `.env`.
6. Restart the app and Caddy.
7. Run `npm run doctor`; HTTP LAN should warn, HTTPS should avoid the phone-camera warning.
8. Run the Phone Smoke Checklist.

Runtime commands for this beta machine:

```powershell
cd C:\Dev\warehouse-it-inventory
npm run start
```

In a second terminal:

```powershell
C:\Tools\caddy\caddy.exe run --config C:\Tools\caddy\Caddyfile
```

Server-side HTTPS smoke checks:

```powershell
curl.exe -k https://warehouse-it.local/api/health
curl.exe -k -I https://warehouse-it.local/login
curl.exe -k -I https://warehouse-it.local/manifest.webmanifest
```

The `-k` flag is only for server-side proxy validation while device trust is being installed. It is not a substitute for trusting the Caddy local CA on the phone.

Alternate: mkcert.

```powershell
mkcert -install
mkcert warehouse-it.local 192.168.0.67 localhost
```

Store generated files in an ignored local folder such as `certs\`. Install/trust the mkcert root CA on the phone. Do not commit cert/key files.

Rollback:

1. Stop Caddy or the HTTPS proxy.
2. Set `APP_BASE_URL=http://192.168.0.67:3000`.
3. Restart the app.
4. Continue with manual scan and scan-from-photo fallback until HTTPS is fixed.

## Beta Release Checklist

Before beta:

- Git working tree reviewed.
- Latest code pushed to GitHub if that is the team workflow.
- Backup created under `C:\Dev\warehouse-it-inventory\backups`.
- `npm run doctor` has no critical warnings.
- `/api/health` is OK or degraded only for SMTP.
- If SMTP is enabled, `/settings` test email works with a QA recipient and no secrets are exposed.
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
