# Warehouse IT Inventory

Phone-first warehouse IT inventory tracking with IPAM, camera scanning, manual location context, employees, and long-term asset assignments.

## What It Does

- Tracks device inventory with IP, MAC, VLAN, range, location, model, serial, status, assignment, notes, and timestamps.
- Tracks full asset inventory fields including asset tag, condition, employee assignment, purchase/warranty dates, area/department, and repair notes.
- Tracks consumables, peripherals, printer supplies, and spare parts by quantity with movement history.
- Supports fast scan-based stock handouts and temporary stock loans for generic items such as keyboards, mice, headsets, cables, adapters, and batteries.
- Supports serialized asset loans/checkouts for temporary handoff of specific devices without replacing long-term assignments.
- Records printer/fixed-asset maintenance history, parts used, cleaning dates, supply replacement dates, and next due dates.
- Generates central operational alerts for IPAM conflicts, low stock, printer maintenance, warranty expiration, RMA follow-ups, loan overdue checks, stock loan overdue checks, and data integrity review.
- Stores asset photo metadata with files on disk for overview photos, asset tags, serial labels, condition, damage, installed-location evidence, RMA/return condition, and other documentation.
- Tracks facturas/purchase records, attached factura PDFs/photos, structured line items, linked assets, linked stock items, vendor details, PO numbers, costs, and warranty dates.
- Tracks optional internal asset value estimates with straight-line depreciation for IT review and decommission snapshots. These estimates can be manually entered or applied from linked factura line items, and are not official accounting book value.
- Adds a lightweight IT Workspace for quick follow-up tasks, PO tracker notes, and common IT resource links.
- Tracks RMA / repair batches for sending groups of devices to repair, following up, and receiving returned devices without deleting assignment history.
- Sends manual SMTP email receipts and summaries for assignments, returns, asset loans, stock issues, stock returns, and RMA cases, with every attempt recorded in `EmailLog`.
- Protects the app with local login accounts, HTTP-only session cookies, and roles for Admin, IT Staff, Viewer, and Auditor access.
- Manages employees and long-term assignment records with captured signatures.
- Defines reserved IP pools by category, VLAN, range, location, and active status.
- Validates IPv4 addresses strictly. For example, `192.168.163.280` is rejected because `280` is outside `0-255`.
- Suggests the first free IP in a selected pool and can reserve it immediately.
- Detects duplicate active/reserved IPs, duplicate active MACs, outside-range assignments, VLAN mismatches, and duplicate device names.
- Runs limited server-side ping/ARP scans and compares discovered addresses against inventory.
- Uses the phone camera to scan QR codes and barcodes for device labels, serial numbers, MACs, IP labels, and internal tags.
- Generates safe asset tag QR/barcode label previews and Zebra ZPL exports without encoding sensitive data.
- Shows stored manual asset location context on a warehouse map.
- Imports and exports CSV for devices, ranges, stock items, stock movements, maintenance records, asset values, facturas, factura line item review, tasks, PO tracker notes, tool links, RMA cases/items, asset loans/items, conflicts, and scan results.
- Includes sample warehouse data and intentional conflicts for testing.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- SQLite
- Prisma ORM
- Vitest

## Setup

Install dependencies:

```bash
npm install
```

Create `.env`:

```bash
cp .env.example .env
```

The default local database is:

```env
DATABASE_URL="file:./dev.db"
SESSION_SECRET=
BITLOCKER_VAULT_SECRET=
```

With Prisma SQLite, this resolves to `prisma/dev.db`.

Set `SESSION_SECRET` or `AUTH_SECRET` to a random value of at least 32 characters before relying on login sessions. The app uses it to protect server-side session tokens. Do not commit this value.

Set `BITLOCKER_VAULT_SECRET` before creating or revealing BitLocker recovery keys. Use a company-approved password manager and a random value of at least 32 characters. Losing this secret means encrypted recovery keys in restored backups cannot be decrypted. Do not commit this value.

Auth setup:

1. Start the app.
2. Open `/setup-admin`.
3. Create the first administrator with a strong password.
4. After the first user exists, `/setup-admin` redirects to login and only Admin users can manage accounts at `/admin/users`.

No default admin account is created. Do not use shared or weak passwords.

Session behavior:

- Login sessions use the `warehouse_session` HTTP-only cookie and a server-side `AppSession` record.
- Normal session lifetime is fixed at 12 hours. The database expiration and cookie `Max-Age` are intentionally aligned.
- When `APP_BASE_URL` starts with `https://`, the session cookie is marked `Secure`; for local HTTP development, use an HTTP `APP_BASE_URL` or leave it unset.
- Use one URL consistently during a session. Do not switch between `https://warehouse-it.local`, `http://192.168.x.x:3000`, `localhost`, and `127.0.0.1` and expect cookies to carry across origins.
- A browser-native username/password popup is not the app login. Treat that as proxy/browser configuration trouble, not an app password prompt.
- Being sent back to the app login after only a few minutes is abnormal. First confirm `APP_BASE_URL`, Caddy host/proto forwarding, and browser cookie settings, then clear site cookies for the exact URL and log in again.
- Rolling session extension is not enabled in this beta phase. The fixed 12-hour lifetime is the expected behavior; revisit rolling refresh only if the team needs longer signed-in shifts.

Optional SMTP settings for manual email receipts:

```env
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
MAIL_FROM=
MAIL_REPLY_TO=
IT_NOTIFICATION_CC=
APP_BASE_URL=
IT_ASSIGNMENT_CC=
IT_LOAN_CC=
IT_RMA_CC=
IT_STOCK_CC=
```

Do not commit real `.env` files or SMTP credentials.

`SMTP_FROM` is the preferred sender setting. `MAIL_FROM` remains supported as a fallback for existing local setups, but keep one sender value consistent.

Generate Prisma Client:

```bash
npm run prisma:generate
```

Run the Prisma migration in normal environments:

```bash
npm run prisma:migrate -- --name init
```

If the Prisma schema engine is blocked on a locked-down Windows/OneDrive machine, use the included local SQLite fallback:

```bash
node prisma/migrate-local.mjs
```

Seed sample data only on a disposable development database. The seed script is destructive and refuses to run unless explicitly enabled:

```powershell
$env:ALLOW_DESTRUCTIVE_SEED="true"
npm run prisma:seed
$env:ALLOW_DESTRUCTIVE_SEED=$null
```

Start development:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## PWA / Installable App

The app includes a basic web app manifest for supported browsers:

- App name: `Warehouse IT Inventory`
- Short name: `Warehouse IT`
- Start URL: `/dashboard`
- Display mode: standalone
- Theme color: slate/dark warehouse shell

To install on a phone or tablet, open the stable internal app URL, sign in, then use the browser's `Add to Home Screen` or `Install app` action. PWA install works best when the app is served from a stable HTTPS origin. This phase does not add offline caching for dynamic inventory data; the installed app still needs the server, database, uploads, and network connection.

Camera permissions are per browser/origin. If the app URL changes from `http://server:3000` to `https://inventory.company.local`, users may need to allow camera access again.

## Offline Queue Foundation

Phase 71 added the foundation for future offline-capable workflows. Phase 72 enabled serialized asset moves, Phase 73 added conflict review, Phase 74 enabled asset photo uploads, and Phase 75 hardened mobile storage safety. The current `/offline` page stores metadata-only queued actions in localStorage, keeps queued photo files in browser IndexedDB, and syncs after the user is online and authenticated.

Current scope:

- `TEST_OFFLINE_NOTE` can sync successfully for QA validation.
- `MOVE_ASSET` can sync successfully for serialized asset relocation only.
- `UPLOAD_ASSET_PHOTO` can sync asset photos captured from an asset detail page. The queue stores only safe photo metadata in localStorage; the image blob stays in browser IndexedDB until sync or cancellation.
- Offline move payloads may include asset tag/device ID, target map anchor or text destination, area/department/station, notes, client timestamp, and last-known status/assignment/map-anchor IDs.
- Offline photo payloads may include device ID/asset tag, file name, MIME type, file size, photo type, caption, source, compression flag, primary-photo request, client timestamp, last-known status, and route.
- The queue is local to the browser and stores no files, PDFs, XMLs, credentials, BitLocker recovery keys, SMTP values, or other secrets in localStorage. Queued asset photo blobs are stored only in IndexedDB on the same browser/device.
- Unsynced asset photos are browser/device-local. Do not clear browser data, switch devices, or uninstall the PWA before syncing queued photos.
- `/offline` shows a storage safety card with queued photo blob count, approximate queued photo size, and browser storage estimate when available.
- Clear synced removes synced local queue metadata and synced photo blobs. Cancelling a pending queued photo asks for confirmation and removes the local photo blob from that browser.
- The server validates authentication, `inventory.write`, payload safety, current asset state, stale status/assignment/map-anchor checks, and target location/anchor before applying a move.
- Asset photo sync uses `POST /api/offline/sync/photo` with multipart form data and reuses the same asset-photo validation/storage path as online uploads.
- Unsupported future action types such as task creation and maintenance creation fail clearly until a later phase implements them.
- Sync conflicts require review. The app does not auto-resolve conflicts, and it does not auto-change inventory when the server sees stale or unsafe data.
- `/offline/conflicts` is the Offline Conflict Review Center for Admin and IT Staff retry/cancel/review actions. Auditors can read sanitized conflict records when audit access is available.
- Data Quality includes an Offline Sync Health card for open conflicts, failed records, recent conflicts, and the oldest open item.

Still not enabled:

- Offline stock photo upload.
- Offline stock issue/loan.
- Offline decommission.
- Offline RMA receive.
- Offline factura extraction/import.
- Offline BitLocker, admin/users/settings, imports, bulk intake, or sensitive workflows.

How to use offline moves:

1. Open `/offline/move`, or use the Offline move action from Quick Scan or an asset detail page.
2. Enter/confirm the asset tag and destination.
3. Queue the move locally.
4. Open `/offline` when online and tap Sync now.
5. Open `/offline/conflicts` for any failed or conflict items; retry only after the issue is understood, cancel stale work, or mark reviewed with a note.

How to use offline asset photos:

1. Open an asset detail page and use the Photos section.
2. Take or choose a photo, pick photo type/caption/primary as usual, then tap Queue offline.
3. Keep the same browser/device until sync; the photo file lives only in local IndexedDB.
4. Open `/offline` when online and tap Sync now.
5. If the asset was retired/disposed, permission changed, the asset cannot be found, or the local browser photo blob is gone, the sync creates a conflict instead of silently applying anything.
6. If browser storage is cleared before sync, the app cannot recreate the local photo file. Retake the photo and cancel or mark the old conflict reviewed.

Conflict review workflow:

1. Open `/offline/conflicts`.
2. Filter by open, failed, conflict, reviewed, cancelled, resolved, action type, asset tag, actor, or client action ID.
3. Expand technical details only when needed; default cards show sanitized queued summaries and server result summaries.
4. Retry runs the same server validation again and does not bypass stale checks. Photo upload conflicts must be retried from the same browser/device's Offline Queue while the local photo blob still exists.
5. Cancel does not apply the queued action.
6. Mark reviewed records the reviewer and note without changing inventory.

Daily beta check:

1. Open `/offline`.
2. Sync pending actions before switching devices or clearing browser data.
3. Open `/offline/conflicts`.
4. Check Data Quality's Offline Sync Health card.
5. Retake any queued photo where the browser-local blob is missing.

Roadmap:

- Phase 72: Offline Scan + Move Queue completed for serialized asset movement.
- Phase 73: Offline Conflict Review Center completed for failed/conflicted test notes and serialized asset moves.
- Phase 74: Offline Photo Upload Queue completed for asset photos only.
- Phase 75: Offline Mobile Field Test + Storage Safety Polish completed for browser-local photo storage warnings, synced blob cleanup, missing-blob failure handling, and mobile-width queue review.
- Phase 76: Real Phone / HTTPS / Camera Beta Validation completed server-side HTTPS runtime checks, fixed Caddy/login redirect behavior for `https://warehouse-it.local`, validated offline note/move/photo sync through the HTTPS API, and kept physical phone camera/PWA validation pending until the actual beta phone is tested.

### Phase 76 HTTPS / Phone Validation Notes

Validation date: June 18, 2026.

Validated from the beta workstation:

- Runtime path: `C:\Dev\warehouse-it-inventory`.
- Preferred URL / `APP_BASE_URL`: `https://warehouse-it.local`.
- HTTPS reverse proxy: Caddy at `C:\Tools\caddy`, proxying to `127.0.0.1:3000`.
- `/api/health` loaded through HTTPS with only the expected SMTP warning.
- Authenticated HTTPS page checks returned OK for `/dashboard`, `/scan`, `/offline`, `/offline/conflicts`, `/offline/move`, `/data-quality`, and the QA asset detail page.
- `TEST_OFFLINE_NOTE` synced successfully through `POST /api/offline/sync`.
- `MOVE_ASSET` synced successfully for QA asset `QA-PHONE-FIELD-001`, moving it to `QA / Phone / Bench 76`.
- `UPLOAD_ASSET_PHOTO` synced successfully for `QA-PHONE-FIELD-001` using a harmless generated PNG. The original image and thumbnail served correctly from `/uploads/assets/...`.
- Storage-loss safety was validated by syncing a photo action without its browser-local file; the server created a reviewed conflict with the message `Local photo file is no longer available. Retake the photo.` and did not create a broken `AssetPhoto`.
- Data Quality Offline Sync Health remains the review location for failed/conflicted browser-queued actions.

Bug fixed during validation:

- Login through the Caddy HTTPS origin was redirecting to `https://localhost:3000/dashboard`. The login route now uses configured `APP_BASE_URL` for public redirects when available, and the Caddy example forwards the public host/proto headers.

Still pending on the actual beta phone:

- Physical phone model/browser result.
- Phone certificate trust without bypassing warnings.
- Phone login and navigation.
- Live camera permission and rear-camera scanner behavior.
- Scan-from-photo/file fallback.
- Manual scan fallback.
- PWA Add to Home Screen / installed-app launch.
- Offline move close/reopen persistence on the phone.
- Offline photo close/reopen persistence on the phone.

Daily mobile beta checklist:

1. Confirm the phone is on the trusted warehouse network and opens `https://warehouse-it.local`.
2. Confirm the certificate is trusted; do not bypass warnings for normal beta users.
3. Log in and open `/dashboard`, `/scan`, `/offline`, `/offline/conflicts`, `/offline/move`, `/data-quality`, and a QA asset detail page.
4. Test manual scan first with `QA-PHONE-FIELD-001`.
5. Test live camera scan only after HTTPS trust is clean.
6. Queue one QA offline move, refresh, close/reopen the browser/app, reconnect, sync, and clear synced.
7. Queue one harmless QA offline photo, refresh, close/reopen, reconnect, sync, confirm original/thumbnail open, and clear synced.
8. Review Data Quality Offline Sync Health and `/offline/conflicts`.
9. Do not clear browser storage while useful offline photo evidence is pending.

## Production Readiness / Before Wider Rollout

### Controlled Team Beta Status

Current verdict for controlled beta: ready for Axel plus one IT teammate with daily backups, local Windows runtime, and known limitations accepted. This is not yet broad production V1.

Ready:

- Windows-native runtime from `C:\Dev\warehouse-it-inventory`.
- Auth/roles, inventory, scan/manual fallback, intake, assignments, loans, stock, RMA, audits, labels, maps, reports, Data Quality, backups, scheduled jobs, factura extraction/line items, asset values, decommission, and BitLocker vault.
- Offline queue foundation for safe test notes, serialized asset moves, and asset photo uploads only. Stock, RMA, decommission, BitLocker, factura, admin, import, bulk intake, and stock photos remain online-only.
- `npm run backup`, `npm run doctor`, `npm run jobs:run-due`, `npm test`, `npm run lint`, and `npm run build` are the required release checks.
- Windows Task Scheduler task `Warehouse IT Inventory Jobs` runs `npm.cmd run jobs:run-due` every 15 minutes from `C:\Dev\warehouse-it-inventory`.

Phase 70 restore drill result:

- Full restore drill completed in `C:\Dev\warehouse-it-inventory-restore-test-phase70` using source backup `C:\Dev\warehouse-it-inventory\backups\manual-20260617-212205`.
- Restore app ran separately on port `3015`; the live app folder, live database, live uploads, and live runtime were not overwritten.
- Restored database accepted `npx prisma migrate status`, `npx prisma migrate deploy`, `npx prisma generate`, `npm run doctor`, and `npm run build`.
- Runtime health was reachable at `http://127.0.0.1:3015/api/health`; degraded warnings were limited to restore-only SMTP/app-base-url configuration.
- Restored uploads served asset photos and factura PDFs with correct content types, blocked traversal, and returned 404 for missing files.
- BitLocker QA vault record restored and decrypted only with the matching restore `.env` `BITLOCKER_VAULT_SECRET`; IT/Viewer reveal attempts were denied.
- Backup-from-restore succeeded at `C:\Dev\warehouse-it-inventory-restore-test-phase70\backups\manual-20260617-213002`.
- Restore-only QA users/sessions were removed after validation; the restored copy showed 6 real users afterward.

Pending / accepted limitations:

- SMTP credentials are not configured unless `.env` is updated later. Manual workflows still save; email sends are skipped or degraded.
- HTTPS/Caddy is configured for server-side testing, but local CA/browser/phone trust must be completed before relying on physical phone camera/PWA install.
- Docker Compose support exists, but Docker Desktop/CLI is not validated on this beta machine.
- `BITLOCKER_VAULT_SECRET` is configured locally; before real recovery keys are stored, keep the same secret in the approved password manager.
- Repeat restore drills remain controlled admin exercises. At minimum, verify every backup includes database plus uploads and that the matching `BITLOCKER_VAULT_SECRET` is available from the approved password manager.

Do not do during controlled beta without explicit Admin approval:

- Do not run `prisma migrate reset`, destructive seed, bulk imports, broad cleanup scripts, direct printer sending, SNMP polling, UniFi work, OCR expansion, or public tunnels.
- Do not commit `.env`, SMTP credentials, `BITLOCKER_VAULT_SECRET`, BitLocker recovery keys, `prisma/dev.db`, uploads, backups, certificates, private keys, logs, or runtime data.
- Do not use real BitLocker recovery keys until the vault secret is stored in the approved password manager and the reveal/audit process has been reviewed.

QA record note:

- `QA-*` assets, `QA-PHASE-*` facturas, and items such as `QA Smoke Mouse` are test evidence. Keep them recognizable as QA records and do not count them as production assets during operational reviews.

### Production V1 Sign-Off Status

Phase 78 verdict:

- Controlled Team Beta is ready for Axel plus one trusted IT teammate.
- Production V1 codebase is ready pending external blockers.
- Wider rollout is not approved until the blockers below are closed and the final rollout checklist is complete.

External blockers:

- Real SMTP provider credentials are still missing; complete one real QA send before using email receipts broadly.
- Real physical phone certificate/camera/PWA validation is still pending on the actual beta phone and browser.
- `BITLOCKER_VAULT_SECRET` must be saved in the approved password manager before real recovery keys are stored.
- Optional `npm audit` / dependency review remains before broad production deployment.

Ready / validated capabilities:

- Core: auth/roles, inventory, scan/manual scan, intake, asset details, assignments, asset loans, stockroom, maintenance, tasks, RMA, labels, maps/locations, reports, Data Quality, backups, restore drill, scheduled jobs, decommission, facturas, factura line items, PDF text extraction, XML extraction, asset value/depreciation, and the encrypted BitLocker vault with fake QA validation.
- Offline: queue foundation, test note, serialized asset move, conflict review center, asset photo upload queue, storage safety warnings, missing browser-blob conflict behavior, and mobile-width QA at 320/360/390.
- Security and safety: health/settings/docs/logs do not expose secrets, BitLocker plaintext is not shown in exports/logs/UI, offline sync is server-validated, backup/restore is documented, and role restrictions are covered by tests and smoke checks.

Not included in Production V1:

- Offline stock issue/return, stock photos, RMA, decommission, BitLocker, factura/import/admin actions, service worker caching, or a full offline inventory database.
- OCR for scanned PDFs beyond the current lightweight extraction work.
- SNMP printer/scale polling, UniFi API integration, direct Zebra printer sending, or automatic emailed reports.
- Docker runtime validation on this beta machine while Docker Desktop/CLI remains unavailable.
- SMTP real send and full physical phone camera/PWA validation until the external blockers are completed.

Rollout checklist before adding more than Axel plus one teammate:

1. Save `BITLOCKER_VAULT_SECRET` in the approved password manager.
2. Complete real phone validation: phone model/browser, certificate trust, live camera scan, PWA/install if needed, offline move close/reopen, offline photo close/reopen, and reconnect sync.
3. Configure SMTP credentials locally, without committing `.env`.
4. Send one real QA test email.
5. Confirm `/api/health` has no degraded SMTP warning.
6. Run `npm run backup` before first real team use.
7. Confirm `npm run jobs:run-due` succeeds.
8. Confirm the current beta URL and `APP_BASE_URL` match, preferably `https://warehouse-it.local`.

Daily beta checklist:

- Start of day: confirm the app opens, check `/api/health`, `/data-quality`, `/offline`, `/offline/conflicts`, confirm jobs, and confirm the latest backup exists.
- During use: sync offline actions before leaving the warehouse, do not clear browser storage with pending photos, review conflicts instead of ignoring them, and do not store real BitLocker keys until the vault secret is safely stored.
- End of day: run `npm run backup`, check failed/conflicted offline syncs, and confirm QA/test records are not mixed into real production counts.

Emergency / disaster checklist:

1. Stop the app.
2. Do not delete the database or upload folders.
3. Copy current `prisma/dev.db`, `uploads/assets`, `uploads/facturas`, `uploads/stock`, and `uploads/maps` to an emergency folder.
4. Identify the latest backup.
5. Restore only to a separate folder first.
6. Confirm `BITLOCKER_VAULT_SECRET` is available.
7. Run `npx prisma migrate status` and `npx prisma migrate deploy`.
8. Run `npm run doctor` and `npm run build`.
9. Test `/api/health` and login.
10. Only then repair or replace the live app.

Losing `BITLOCKER_VAULT_SECRET` means existing encrypted BitLocker keys cannot be decrypted.

### Phase 79 Phone Validation Status

Phase 79 workstation-side HTTPS validation passed on June 18, 2026:

- Runtime path: `C:\Dev\warehouse-it-inventory`.
- Current beta URL / `APP_BASE_URL`: `https://warehouse-it.local`.
- Workstation LAN IP shown by Next runtime: `192.168.0.67`.
- Caddy is running from `C:\Tools\caddy\caddy.exe` and proxies to the app on port `3000`.
- `https://warehouse-it.local/api/health` is reachable and degraded only because SMTP is not configured.
- `https://warehouse-it.local/login` opens.
- Authenticated login redirects to `https://warehouse-it.local/dashboard`, not localhost or `127.0.0.1`.
- Authenticated workstation HTTPS checks passed for `/dashboard`, `/scan`, `/devices`, QA asset detail, `/offline`, `/offline/move`, `/offline/conflicts`, `/data-quality`, `/reports`, and the QA asset photo/thumbnail routes.

Real phone validation remains pending and must not be marked complete until the actual beta phone is tested:

- Phone model / OS / browser: pending.
- Phone network and `warehouse-it.local` DNS resolution: pending.
- Certificate trust without browser warnings: pending.
- Live camera scan: pending.
- Manual asset-tag fallback: pending on phone.
- Scan-from-photo/file fallback: pending on phone.
- PWA Add to Home Screen / installed launch: pending.
- Offline move close/reopen/reconnect sync on phone: pending.
- Offline photo close/reopen/reconnect sync on phone: pending.
- Storage-loss safety on phone: skipped until safe; rely on Phase 75/76 workstation validation for now.

Daily mobile beta checklist remains: use QA asset `QA-PHONE-FIELD-001`, do not move real assets, do not upload real production photos, do not clear browser storage while queued photos are pending, and document exact phone/browser results before closing this blocker.

### Phase 80 Actual Beta Phone Field Run Status

Phase 80 workstation-side readiness passed on June 18, 2026, but the actual beta phone field run was not completed in this Codex session because no physical phone/browser results were available.

Classification: **BLOCKED / NOT RUN ON PHONE**.

What was confirmed from the workstation:

- `https://warehouse-it.local/api/health` is reachable and degraded only because SMTP is not configured.
- `https://warehouse-it.local/login` opens through Caddy.
- Login redirects to `https://warehouse-it.local/dashboard`, not localhost or `127.0.0.1`.
- Authenticated HTTPS checks returned 200 for `/dashboard`, `/scan`, `/devices`, QA asset detail, `/offline`, `/offline/move`, `/offline/conflicts`, `/data-quality`, `/reports`, and QA asset photo/thumbnail routes.

What remains to be tested on the actual phone:

- Phone model, OS, browser, Wi-Fi/network, and URL tested.
- Phone DNS resolution for `warehouse-it.local`.
- Certificate trust with no warning.
- Live camera scanner and rear-camera behavior.
- Manual `QA-PHONE-FIELD-001` fallback.
- Scan-from-photo/file fallback.
- Add to Home Screen / PWA behavior.
- Offline move close/reopen/reconnect sync to `QA / Phone / Bench 80`.
- Offline photo close/reopen/reconnect sync.
- Optional storage-loss safety test on a safe phone browser/profile.

Do not mark the real-phone blocker closed until those phone results are recorded. If direct LAN HTTP is used as a fallback, document it as a fallback and keep trusted HTTPS/camera validation open.

### Phase 82 Actual Phone Field Run Status

Phase 82 workstation-side checks passed on June 19, 2026, but the actual phone field run was **not completed** because no physical phone/browser results were provided in this Codex session.

Classification: **BLOCKED / NOT RUN ON PHONE**.

Workstation checks completed:

- Runtime path: `C:\Dev\warehouse-it-inventory`.
- Current beta URL: `https://warehouse-it.local`.
- Latest commit before Phase 82 docs: `8f59e88 Stabilize session persistence`.
- Caddy was running from `C:\Tools\caddy\caddy.exe`.
- App was restarted and listened on port `3000`.
- `https://warehouse-it.local/api/health` returned 200 and was degraded only because SMTP is not configured.
- `https://warehouse-it.local/login` opened.
- Unauthenticated `/dashboard` redirected to login.
- Temporary Admin login redirected to `https://warehouse-it.local/dashboard`, not localhost or `127.0.0.1`.
- Authenticated `/dashboard` returned 200.
- Temporary QA user/session/login activity was deleted after the smoke check.

Actual phone result fields remain pending:

- Phone model:
- OS version:
- Browser:
- Network/Wi-Fi:
- Workstation LAN IP:
- URL tested:
- HTTP or HTTPS:
- Same network as workstation:
- DNS result for `warehouse-it.local`:
- Certificate trusted with no warning:
- Login/session works after refresh:
- Camera scan result:
- Manual `QA-PHONE-FIELD-001` fallback:
- Scan-from-photo/file fallback:
- PWA / Add to Home Screen result:
- Offline move close/reopen/sync result for `QA / Phone / Bench 82`:
- Offline photo close/reopen/sync result:
- Storage-loss safety result:
- Mobile layout result:
- Final classification: PASS / PARTIAL / FAIL, only after a real phone test.

Next action: run the actual phone checklist with QA asset `QA-PHONE-FIELD-001`. Do not close the physical phone blocker until those fields are filled with real phone/browser results.

### Phase 83 SMTP Real Credentials + First QA Email Status

Phase 83 workstation-side SMTP safety checks ran on June 19, 2026, but no approved real SMTP credentials were available in this Codex session.

SMTP status: **BLOCKED / WAITING ON SMTP CREDENTIALS**.

Provider type: pending approved provider selection. Acceptable options remain company-approved SMTP such as Google Workspace SMTP relay, Microsoft 365 SMTP, SendGrid, Mailgun, or an internal company SMTP relay. Do not use a personal account password unless explicitly approved.

What was verified:

- Local `.env` was not modified.
- No SMTP credentials, passwords, or secrets were printed or committed.
- `npm run doctor` reported only the expected missing SMTP warning.
- `https://warehouse-it.local/api/health` returned sanitized SMTP status with no SMTP password, auth secret, BitLocker vault secret, or recovery key material.
- `/settings` loaded for Admin and did not expose SMTP password, auth secret, BitLocker vault secret, or recovery key material.
- Unauthenticated `POST /api/email/test` returned 401.
- Viewer `POST /api/email/test` returned 403.
- Admin malformed JSON to `POST /api/email/test` returned a clear 400.
- Admin test email with missing SMTP returned 422 skipped, not a fake success.
- A safe `EmailLog` skipped record was created for the missing-SMTP attempt and did not contain SMTP credentials, auth secrets, BitLocker vault secret, recovery keys, or stack traces.
- Scheduled jobs ran without sending email or spamming users.

First real QA email: **not sent**. No approved SMTP credentials or approved QA recipient were provided.

APP_BASE_URL link expectation remains `https://warehouse-it.local`. Email template links must not use localhost, `127.0.0.1`, old LAN IPs, file paths, or OneDrive paths.

Next action: configure approved SMTP credentials only in local `.env`, restart the app, rerun `npm run doctor`, and send exactly one QA test email to an approved QA recipient. Do not commit `.env` or any credentials.

### Phase 84 Final Production V1 Go / No-Go

Phase 84 final workstation-side sign-off ran on June 19, 2026.

Final verdicts:

- Controlled Team Beta: **GO** for Axel plus one trusted IT teammate.
- Production V1 Codebase: **READY pending external/manual blockers**.
- Wider Rollout: **NO-GO** until the blockers below are closed and reviewed.

Final Go / No-Go Matrix:

| Area | Status | Notes |
| --- | --- | --- |
| Codebase | READY | Tests, lint, build, migrations, backup, jobs, and runtime smoke are the required release gate. |
| Controlled beta | GO | Approved only for Axel plus one trusted IT teammate using the documented beta checklist. |
| Wider rollout | NO-GO | Wait for real phone validation, approved SMTP, BitLocker secret storage, and optional dependency review. |
| Phone validation | BLOCKED | Real physical phone DNS/certificate/camera/PWA/offline persistence results are still required. |
| SMTP | BLOCKED | Approved SMTP provider credentials and one real QA email are still required. |
| BitLocker secret storage | MANUAL REQUIRED | Store `BITLOCKER_VAULT_SECRET` in an approved password manager before relying on vault continuity. |
| Backup/restore | GO | Backup and restore drill are documented; backups must include database and uploads. |
| Offline move/photo | GO for controlled beta | Offline serialized moves and asset photo queue are allowed with the documented conflict limits. |
| Sessions/auth | GO | Rolling session expiry and HTTPS logout redirect behavior are documented and tested. |
| Caddy HTTPS workstation route | GO | Workstation-side `https://warehouse-it.local` route is the preferred beta path. |
| Data Quality/reports | GO | Existing review/export surfaces are available for beta operations. |
| Git/secret safety | GO | Confirm no secrets/runtime data are tracked by Git before each push. |

### Phase 87 Performance / Slow Page Audit

Phase 87 measured the production build from `C:\Dev\warehouse-it-inventory` against the controlled beta SQLite data. The app stayed functional, and the highest-risk API payloads were tightened without changing business workflows.

Performance fixes:

- `/api/devices` is now bounded and paginated by default. `limit` is capped at 100, the default page size is 50, and the response includes pagination metadata instead of returning the full inventory.
- `/api/data-quality` now returns a compact health/summary payload by default. Use `/api/data-quality?detail=preview` for a capped preview of the review object, `/api/data-quality?detail=full` only for deliberate debugging, and the existing CSV export routes for full review exports.
- Guardrail tests cover the bounded device API and summary-first data-quality API behavior.

Measured after the fix:

- `/api/devices?limit=50`: about 18 KB, roughly 29 ms median in local production timing.
- `/api/data-quality`: about 1 KB, roughly 31 ms median in local production timing.
- `/api/data-quality?detail=preview`: intentionally heavier because it still computes the full Data Quality review before summarizing it.

Known acceptable heavier pages:

- `/devices`, `/inventory/[view]`, `/dashboard`, and `/data-quality` still compute whole-inventory signals such as duplicate IPs, missing photos, review reasons, maintenance cues, and dashboard totals. They are acceptable for controlled beta with roughly 3,300 assets, but future broad rollout should consider server-side aggregate helpers for these views.
- CSV exports and full-detail review endpoints are expected to be heavier and should be treated as deliberate admin/audit actions, not polling endpoints.

Ready for Production V1 controlled beta:

- Auth/roles, inventory, assignments, stock, loans, RMA, audits, labels, reports, backups, scheduled jobs, email plumbing, BitLocker vault, offline serialized move, and offline asset photo queue.
- Daily beta checklist, emergency / disaster checklist, migration safety, restore runbook, and single-URL session guidance.
- Workstation-side HTTPS smoke using `https://warehouse-it.local`, with protected pages requiring login and logout returning to the public login URL.

Still blocked before wider rollout:

- Real physical phone validation on the actual beta phone/browser.
- Real SMTP provider credentials plus exactly one approved QA email.
- `BITLOCKER_VAULT_SECRET` stored in an approved password manager with recovery instructions.
- Optional `npm audit` / dependency review before wider production deployment.

Do not include in Production V1: Offline stock issue/return, service worker caching, OCR expansion, SNMP printer/scale polling, UniFi API integration, direct Zebra printer sending, broad importer work, public tunnels, or destructive database reset paths.

### Phase 85 UI / UX Visual Polish + Accessibility

Phase 85 keeps business logic frozen and improves the controlled beta UI language.

Status color meanings:

- Neutral/default: ordinary metadata or inactive records.
- Success/synced: healthy state, completed sync, available confirmation, or safe pass.
- Warning/offline/pending: review soon, queued offline work, due soon, or non-blocking attention.
- Danger/conflict: failed action, destructive action, missing/lost item, conflict, or blocked state.
- Info/inventory/maintenance/admin: contextual labels for inventory, maintenance, security/admin, or explanatory system state.

UI expectations:

- Do not rely on color alone; badges and cards must include text labels such as Healthy, Review, Pending, Conflict, Failed, or Synced.
- Primary actions are explicit: Save, Sync now, Create, Upload, Queue offline.
- Destructive or risky actions use danger styling and clear labels such as Cancel queued action.
- Empty states explain what happened and what to do next.
- Mobile layouts should remain card-first with large tap targets and no horizontal overflow at 320px.
- Icon-only controls need accessible names through visible text, `aria-label`, or equivalent labeling.

Phase 85 intentionally did not add workflows, offline action types, service worker caching, OCR, SNMP, UniFi, Zebra printing, database model changes, or business-rule changes.

### Phase 86 Design System and UI Preview Lab

Phase 86 adds an internal admin-only UI Preview Lab at `/admin/ui-preview`. It is a static visual review page for common app patterns and does not mutate data, upload files, send email, require real inventory, or depend on warehouse network access.

Preview Lab sections:

- Color/status tokens
- Buttons
- Badges
- Cards and empty states
- Alerts
- Forms
- Desktop table and mobile card patterns
- Offline queue examples
- Offline conflict examples
- Asset status and danger-zone examples
- Mobile layout stress sample

Component usage rules:

- Use semantic status tones: neutral, success, warning, danger, info, pending, synced, conflict, offline, admin/security, maintenance, and inventory.
- Color is not the only status signal. Use text labels with color, such as Healthy, Review, Pending, Synced, Failed, Conflict, Overdue, or Restricted.
- Use `ActionLink` or `actionButtonClass` for common actions. Prefer primary, secondary, subtle, success, warning, danger, or ghost instead of one-off button colors.
- Use `SectionCard`, `MobileCard`, `MetricCard`, `AlertPanel`, and `EmptyState` for repeated surfaces when practical.
- Keep empty states actionable: tell the user what happened and what to do next.
- Danger actions must use explicit labels such as Cancel queued action, Delete photo, Retire asset, or Decommission asset.
- Mobile layouts must remain card-first, tap-safe, and free of horizontal overflow at 320px.
- Icon-only controls must have visible text, `aria-label`, `title`, or an associated label.

Phase 86 intentionally did not add business workflows, database models, offline action types, service worker caching, OCR, SNMP, UniFi, Zebra printing, SMTP, BitLocker, phone-validation work, or production rollout changes.

### Phase 88 Real Visual QA / Screenshot Polish

Phase 88 was a visual stabilization pass only. It did not add workflows, offline action types, service worker caching, OCR, SNMP, UniFi, Zebra printing, SMTP, BitLocker behavior, database model changes, or production phone validation.

Validated with a temporary authenticated local session and read-only route smoke:

- `/dashboard`
- `/scan`
- `/devices`
- QA asset detail page
- `/offline`
- `/offline/conflicts`
- `/offline/move`
- `/data-quality`
- `/reports`
- `/settings`
- `/admin/ui-preview`
- Optional pages: `/stock`, `/maintenance`, `/facturas`, `/admin/users`, `/admin/bitlocker`, `/backups`, and `/jobs`

The embedded browser screenshot pass was blocked by the known local `127.0.0.1:3000` redirect-loop/browser-state issue, so this pass used authenticated HTTP route smoke plus source/layout review instead of claiming screenshot coverage.

Polish applied:

- Shared action buttons now protect icon sizing and wrap long labels more safely on narrow screens.
- Page headers now tolerate long titles without forcing horizontal overflow.
- Status badges can wrap long labels instead of stretching cards.
- Offline sync record text uses an ASCII-safe separator to avoid mojibake in terminal/browser rendering.

Production update runbook:

1. Run `npm run backup`.
2. Pull the latest code.
3. Run `npm install`.
4. Run `npx prisma migrate deploy`.
5. Run `npx prisma generate`.
6. Run `npm run doctor`.
7. Run `npm run build`.
8. Restart the app.
9. Check `/api/health`.

Disaster restore runbook:

1. Stop the affected app/server.
2. Do not overwrite the live folder first. Create a separate restore folder, for example `C:\Dev\warehouse-it-inventory-restore-test-YYYYMMDD`.
3. Clone or copy the current code into that restore folder.
4. Restore the matching backup contents:
   - `prisma/dev.db`
   - `uploads/assets`
   - `uploads/stock`
   - `uploads/facturas`
   - `uploads/maps`
5. Restore a local `.env` with the same `SESSION_SECRET` or a new session secret, the correct `DATABASE_URL`, the correct `APP_BASE_URL` for the test port, and the same `BITLOCKER_VAULT_SECRET` used when BitLocker keys were encrypted. Do not print or commit secrets.
6. Run `npm install`.
7. Run `npx prisma migrate status`.
8. Run `npx prisma migrate deploy`.
9. Run `npx prisma generate`.
10. Run `npm run doctor`.
11. Run `npm run build`.
12. Start the restored app on a separate port, for example `PORT=3015 npm run start`.
13. Check `/api/health`, `/login`, representative asset detail pages, Data Quality, reports, facturas, uploads, scheduled jobs status, and BitLocker role behavior if vault records exist.
14. Run `npm run backup` from the restore folder and verify the backup is created under the restore folder, not the live app folder.
15. Only after the restore copy is verified should an Admin decide whether to promote restored files back into the live folder.

Never use `prisma migrate reset`, destructive seed, broad cleanup scripts, or source workbook imports as a restore shortcut.

Before using this with more internal users:

- Move the active project out of OneDrive to `C:\Dev\warehouse-it-inventory`; keep OneDrive for copies/exports if useful.
- Configure backups and verify they include `prisma/dev.db`, `uploads/assets`, `uploads/stock`, `uploads/facturas`, and `uploads/maps`.
- Configure Windows Task Scheduler to run `npm run jobs:run-due` on the chosen interval.
- Configure SMTP only if manual email receipts are needed.
- Configure `SESSION_SECRET` or `AUTH_SECRET`, create the first Admin, and verify `/login`, `/logout`, and `/admin/users`.
- Do not commit `.env`, SMTP credentials, or local backup files.
- Do not run the destructive Prisma seed on real/imported data.
- Review `npm audit` warnings before production deployment. Known dependency areas to review carefully include `xlsx` for workbook parsing and `nodemailer` for SMTP; do not blindly upgrade if it breaks importer or email behavior.
- Review user roles before wider internal rollout. Admin can manage settings, backups, jobs, imports, and users. IT Staff can perform daily inventory/workflow writes. Viewer can read inventory. Auditor can read inventory and perform audit scans.
- Use HTTPS for phone camera scanning and PWA install. `localhost` works for desktop development, but phones on the LAN normally need HTTPS or a trusted internal certificate.
- Verify asset photos, stock photos, map images, and factura files still open after backup/restore testing.
- UniFi/API sync is disabled and unavailable due to company rules. Normal operations should rely on manual location updates, IPAM, scheduled jobs, alerts, data quality checks, RMA/loan reminders, stock thresholds, and photo compliance.

## HTTPS / Trusted Phone Camera Setup

The current controlled beta can still run over plain HTTP at `http://192.168.0.67:3000`, but phone camera access, photo capture, barcode scanning, and PWA install are more reliable from an HTTPS/trusted origin. Desktop `localhost` is treated specially by browsers; a phone opening a LAN IP usually is not.

Recommended beta strategy: keep the app LAN-only and put Caddy in front of the existing Windows-native `npm run start` process. Caddy terminates HTTPS and reverse proxies to `127.0.0.1:3000`. Do not expose the app publicly in this phase.

The reverse proxy must preserve the public host and protocol. If the app sees only `localhost:3000`, login redirects can break phone access by sending the browser to `https://localhost:3000/dashboard`.

Login stability depends on the browser using the same public origin for the whole session. For the controlled beta, prefer `https://warehouse-it.local` everywhere. If an Admin signs in through the HTTPS hostname and later opens the LAN IP or `localhost`, that is a different browser origin and may look like a lost session. The active Caddy config should forward `Host {host}`, `X-Forwarded-Host {host}`, and `X-Forwarded-Proto {scheme}` or an explicit HTTPS value.

Current HTTP fallback:

- Use manual scan input if live camera is blocked.
- Use scan-from-photo/gallery upload when the browser permits file selection.
- Continue using `http://192.168.0.67:3000` only as a fallback while HTTPS trust is being set up.

### Option A: Caddy Reverse Proxy

1. Keep the app running normally on the server:

   ```powershell
   cd C:\Dev\warehouse-it-inventory
   npm run start
   ```

2. Install Caddy for Windows from the official Caddy project or an approved internal package source.
3. Copy `Caddyfile.example` to a local Caddyfile location outside Git-tracked secrets if you need local edits.
4. Use a local hostname such as `warehouse-it.local`:

   ```text
   {
     skip_install_trust
   }

   https://warehouse-it.local {
     tls internal
     reverse_proxy 127.0.0.1:3000 {
       header_up Host {host}
       header_up X-Forwarded-Host {host}
       header_up X-Forwarded-Proto {scheme}
     }
   }
   ```

5. Point `warehouse-it.local` to the server IP through local DNS or a hosts-file entry on test devices where appropriate.
6. Start Caddy manually for testing or install it as a Windows service after the config is reviewed.
7. `tls internal` keeps the beta LAN-only by using Caddy's local CA instead of public certificate issuance. `skip_install_trust` prevents hidden startup prompts; install and trust the relevant local CA on the phone before beta users rely on it.
8. Update local `.env`:

   ```text
   APP_BASE_URL=https://warehouse-it.local
   ```

9. Restart the app and run `npm run doctor`. A plain HTTP LAN `APP_BASE_URL` should warn; an HTTPS URL should pass.

Do not commit Caddy-generated certificates, private keys, local CA files, or edited configs that contain local secrets.

Phase 62 local runtime notes:

- Caddy v2.11.4 can be installed globally with Winget when the Windows certificate store allows it, or run from a reviewed local tools folder such as `C:\Tools\caddy`.
- The runtime Caddyfile should use `skip_install_trust`, `tls internal`, and `reverse_proxy 127.0.0.1:3000`.
- Start the app first with `npm run start`, then start Caddy with:

  ```powershell
  C:\Tools\caddy\caddy.exe run --config C:\Tools\caddy\Caddyfile
  ```

- Validate the proxy from the server with:

  ```powershell
  curl.exe -k https://warehouse-it.local/api/health
  ```

- If browser or phone testing shows a certificate authority warning, HTTPS is serving but the device does not yet trust the Caddy local CA. Install/trust the Caddy local root certificate on that device before relying on camera/PWA testing. Do not bypass certificate warnings for real beta users unless Admin explicitly accepts the risk.

### Option B: mkcert Local Certificate

Use mkcert only if the team prefers managing local cert files directly.

1. Install mkcert on the server from an approved source.
2. Run:

   ```powershell
   mkcert -install
   mkcert warehouse-it.local 192.168.0.67 localhost
   ```

3. Store generated cert/key files in a local ignored folder such as `certs\` outside commits.
4. Configure an HTTPS reverse proxy to use those files, or use another approved local TLS terminator.
5. Install/trust the mkcert root CA on the phone. Do not bypass certificate warnings for real beta users unless Admin explicitly accepts that risk.
6. Set `APP_BASE_URL=https://warehouse-it.local` or `APP_BASE_URL=https://192.168.0.67`.

### Option C: Tunnel / Real Domain

Tailscale Funnel, Cloudflare Tunnel, or a real public domain should be used only after approval. A tunnel can expose the app outside the LAN if misconfigured. Auth helps, but it is not a substitute for network controls.

### Phone HTTPS Validation Checklist

On a real phone:

1. Connect to the same trusted network.
2. Open the HTTPS beta URL.
3. Confirm the certificate is trusted without bypassing warnings.
4. Log in as IT Staff.
5. Add to Home Screen / install the PWA.
6. Open the installed app.
7. Open `/scan`.
8. Allow camera access.
9. Scan a safe label or search `QA-SMOKE-001`.
10. Open `QA-SMOKE-001`.
11. Upload one safe photo from camera.
12. Confirm the thumbnail appears.
13. Verify manual scan and gallery upload still work as fallbacks.
14. Log out.

Security boundaries:

- Keep this beta LAN-only.
- Do not port-forward ports `3000` or `443` to the internet.
- Do not publish a tunnel URL without auth and network review.
- Protect the server PC login.
- Keep backups running; HTTPS does not replace backups.
- Do not commit `.env`, generated certs, private keys, local CA files, backups, database files, uploads, or secrets.

## Team Beta Ops Setup

Use this checklist for the controlled Axel + one IT teammate beta. Keep the active project at:

```text
C:\Dev\warehouse-it-inventory
```

### Phase 53 Runtime Decision

The current controlled beta runtime is Windows-native:

- Start command: `npm run start` from `C:\Dev\warehouse-it-inventory`.
- Production port: `3000`.
- Current beta URL / `APP_BASE_URL`: `http://192.168.0.67:3000`.
- Scheduler: Windows Task Scheduler task `Warehouse IT Inventory Jobs` every 15 minutes.
- Docker Compose is supported by the repo but is not the selected runtime on this machine because Docker CLI/Desktop is not installed or available.
- Use exactly one scheduler. Do not enable the Docker Compose `jobs` profile while the Windows Task Scheduler job is active.
- Phase 54 baselined the current real SQLite database into Prisma migration metadata. Future schema migrations can use `npx prisma migrate deploy` after a backup.
- Phase 59B reconciled asset value/depreciation work into this correct beta path. Asset values are optional internal IT estimates stored in `AssetValueProfile`; run `npm run backup` before migrations and use `npx prisma migrate deploy`, never `prisma migrate reset`, on real data.

### Phase 55 Phone / PWA / Camera Beta Notes

Server-side LAN checks passed for the beta URL on `/api/health`, `/login`, `/scan`, `/devices`, `/reports`, `/photos/compliance`, and `/map`. The PWA manifest is available and includes PNG icons plus the SVG icon for broader Android/iOS install compatibility.

Real phone testing still needs to be completed on the actual teammate device/browser. Record the device/browser, PWA install result, camera permission result, manual scan fallback result, and photo upload result in the beta notes. If phone camera access is blocked over the HTTPS beta URL, check local DNS/hosts resolution and certificate trust first, then continue beta with manual scan, scan-from-photo, and gallery upload as fallback.

### Prisma Migration Baseline Safety

Prisma `P3005` means the database is non-empty but Prisma migration metadata does not know which migrations are already represented in the schema. Never fix this with `prisma migrate reset` on real data; reset is destructive.

The safe baseline workflow is:

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

Only run apply when the dry run says every migration footprint is present. The helper marks existing migrations as applied; it does not delete data, reset schema, seed data, or apply new migrations.

Run a backup before changing settings, creating beta users, running migrations, bulk intake, imports, decommission testing, or any major workflow test:

```powershell
cd C:\Dev\warehouse-it-inventory
npm run backup
```

### APP_BASE_URL And LAN Access

`APP_BASE_URL="http://localhost:3000"` only works on the server itself. For phone or teammate access, set `APP_BASE_URL` in `.env` to the reachable server IP or hostname, for example:

```env
APP_BASE_URL="http://192.168.X.X:3000"
```

Find candidate server IPs with:

```powershell
ipconfig
```

Then test from another PC or phone on the same network:

```text
http://SERVER-IP:3000/login
```

If the phone camera is blocked on `http://SERVER-IP:3000`, that is a browser/trusted-origin limitation. Manual scan input and gallery upload can still be used for early beta; full phone camera/PWA testing may require HTTPS or a trusted internal origin.

### Windows Firewall Checklist

Do not make broad firewall changes casually. For beta access:

1. Confirm the app is running on port `3000`.
2. Confirm the server IP with `ipconfig`.
3. Allow Node.js/npm through Windows Firewall or open inbound TCP `3000` for the trusted internal network profile.
4. Test from another PC: `http://SERVER-IP:3000/login`.
5. Test from a phone on the same Wi-Fi.
6. If it fails, check VPN, guest Wi-Fi, VLAN, or network segmentation rules.

### Scheduled Jobs

Manual verification:

```powershell
cd C:\Dev\warehouse-it-inventory
npm run jobs:run-due
```

Recommended Windows Task Scheduler action:

```text
Program:
npm.cmd

Arguments:
run jobs:run-due

Start in:
C:\Dev\warehouse-it-inventory

Cadence:
Every 15 minutes
```

Optional helper script:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\register-jobs-task.ps1
```

The helper registers `Warehouse IT Inventory Jobs`, runs from `C:\Dev\warehouse-it-inventory`, writes to `logs\jobs-run-due.log`, and defaults to a non-elevated limited run level. If Windows policy requires elevation, run it from an elevated PowerShell window with `-RunElevated`. It does not store or print secrets.

### Startup Helper

Production-like local start:

```powershell
cd C:\Dev\warehouse-it-inventory
npm run start
```

Optional helper:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-production.ps1
```

Use `-Build` only when you intentionally want the helper to run `npm run build` before starting.

### SMTP Readiness

Email is optional for beta. Without SMTP, workflows still save normally and `/api/health` may show degraded only because email is not configured.

SMTP enables manual email receipts/summaries where implemented. Configure `.env` without committing secrets:

```env
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
MAIL_FROM=
APP_BASE_URL=
```

Use `/settings` to verify the sanitized SMTP status: configured yes/no, host present, from present, effective port, secure mode, auth present, and `APP_BASE_URL`. The SMTP password is never shown. Do not send real emails until credentials and recipients are intentional.

Phase 77 SMTP validation status:

- Current preferred beta link for email templates is `https://warehouse-it.local`.
- Real SMTP provider credentials are not committed and were not present during the Phase 77 smoke. This is an expected blocker for a real send; do not fake success.
- `/api/email/test` requires Admin, rejects Viewer, logs skipped attempts when SMTP is missing, and returns a clear client error for malformed JSON.
- Automated template tests validate assignment, asset loan, and RMA email bodies without real SMTP credentials. Real template smoke should use one approved QA recipient first.
- `EmailLog` stores status, recipient, subject, and sanitized error/message IDs only. It must not store SMTP passwords, auth secrets, BitLocker vault secrets, or recovery keys.
- Scheduled jobs continue to create/update alerts only; automatic email sending from jobs remains disabled unless a future explicit setting is added.

### Beta Users

Recommended roles:

- Axel: `ADMIN`
- IT teammate: `IT_STAFF`
- Optional test/read account: `VIEWER`
- Optional audit test account: `AUDITOR`

Role intent:

- `ADMIN`: users, settings, backups, imports, jobs, and daily work.
- `IT_STAFF`: daily inventory work, intake, stock, assignments, loans, RMA, photos, labels, tasks, audits.
- `AUDITOR`: inventory read and audit scanning/review.
- `VIEWER`: read-only inventory access.

Do not write passwords into README, tickets, screenshots, or chat logs. If Phase 50 QA smoke users are still present, keep them only if they are useful for testing, otherwise deactivate them from `/admin/users` before real beta.

### Phone / PWA / Camera Smoke Checklist

On the phone:

1. Open `http://SERVER-IP:3000/login`.
2. Log in as the IT Staff beta user.
3. Add to Home Screen if the browser supports it.
4. Open from the home screen.
5. Open `/scan`.
6. Allow camera if the browser permits.
7. Scan a safe QR/barcode/Data Matrix.
8. If camera is unavailable, manually search `QA-SMOKE-001`.
9. Open the asset detail page.
10. Upload one photo using camera or gallery.
11. Verify the thumbnail appears.
12. Verify bottom navigation and the More drawer.
13. Check for horizontal overflow at phone width.
14. Log out.

If camera access is blocked because the LAN origin is not trusted, document HTTPS/trusted-origin setup as pending and continue early beta with manual scan and gallery fallback.

### Team Beta SOP

See [`docs/BETA-SOP.md`](docs/BETA-SOP.md) for the daily-use SOP, admin approval rules, bug report format, and beta release checklist.

## Docker / Docker Compose Deployment

Docker support is intended for a stable internal PC/server with persistent bind mounts for SQLite, uploads, and backups. Do not bake live data into the image and do not commit Docker runtime data.

### Persistent Data Layout

Host folders:

```text
data/
  prisma/
    dev.db
    schema.prisma
    migrations/
  uploads/
    assets/
    assets/thumbs/
    stock/
    stock/thumbs/
    facturas/
    maps/
  backups/
```

Compose mounts:

```text
./data/prisma  -> /app/prisma
./data/uploads -> /app/uploads
./data/backups -> /app/backups
```

`/data/` is ignored by Git. Keep external backups of the whole `data/` folder when the app becomes important to daily work.

### Environment

Copy the example and fill in real values:

```powershell
copy docker-compose.example.env .env.docker
```

If you want Docker Compose to read the values automatically for interpolation, copy the values into `.env` or run Compose from a shell where those variables are set. Do not commit real `.env`, `.env.docker`, SMTP credentials, database files, uploads, or backups.

Required:

```env
DATABASE_URL=file:./dev.db
SESSION_SECRET=replace-with-a-long-random-secret-at-least-32-characters
APP_BASE_URL=http://SERVER-IP:3000
```

Inside the container, Prisma resolves `file:./dev.db` relative to `/app/prisma/schema.prisma`; the host file is `./data/prisma/dev.db`.

Optional SMTP:

```env
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
MAIL_FROM=
SMTP_SECURE=false
```

### First Run

1. Install Docker Desktop on Windows.
2. Use the WSL2 backend if available.
3. Set `SESSION_SECRET` and `APP_BASE_URL`.
4. Create the persistent folders:

```powershell
mkdir data\prisma,data\uploads,data\backups
```

5. Build and start:

```powershell
docker compose up -d --build
docker compose logs -f app
```

6. Open `http://SERVER-IP:3000/login`.
7. Create the first Admin at `/setup-admin` if this is a new database.
8. Check health:

```powershell
curl http://localhost:3000/api/health
```

Container startup runs:

- `npx prisma generate --schema=/app/prisma/schema.prisma`
- `npx prisma migrate deploy --schema=/app/prisma/schema.prisma`
- `npm run start`

It does not run destructive reset commands and does not seed data automatically.

If Docker is pointed at a new empty `data/prisma/dev.db`, migrations can run normally. If Docker is pointed at an existing copied SQLite database, baseline that database first or `prisma migrate deploy` can fail with `P3005`. Do not run `prisma migrate reset` against a copied real database.

### Update

```powershell
git pull
docker compose exec app npm run backup
docker compose down
docker compose up -d --build
docker compose logs -f app
```

Then check `/api/health`.

### Backup

Run:

```powershell
docker compose exec app npm run backup
```

Verify the backup appears under `data/backups`. Also back up the whole `data/` folder externally so database records and uploaded files stay together.

### Restore

1. Stop containers:

```powershell
docker compose down
```

2. Restore matching database and uploads into `data/`:

```text
data/prisma/dev.db
data/uploads/assets
data/uploads/stock
data/uploads/facturas
data/uploads/maps
data/backups
```

3. Start:

```powershell
docker compose up -d
```

4. Check `/api/health`, asset photos, stock photos, map images, facturas, reports, and jobs.

Restoring only the database without uploads can break photo/factura/map links. Restoring uploads without the matching database can leave orphaned files.

### Scheduled Jobs

Use exactly one scheduler method:

- Windows Task Scheduler on the host, or
- Docker Compose `jobs` service, not both.

Default Compose only starts the app. To use the optional Docker jobs loop:

```powershell
docker compose --profile jobs up -d --build
```

The jobs service runs:

```text
while true; do npm run jobs:run-due; sleep 900; done
```

SQLite supports this small internal deployment, but avoid multiple overlapping job runners. The app also has job-level duplicate-running protection.

### Windows / Docker Desktop Notes

- Docker Desktop is required on Windows.
- WSL2 backend is recommended.
- Bind mounts come from the project folder, so keep `data/` on a stable disk.
- Windows Firewall may need inbound TCP `3000` allowed for the private/trusted network.
- Test from another PC: `http://SERVER-IP:3000/login`.
- Test from phone on the same Wi-Fi.
- Phone camera over HTTP/LAN may still be limited; HTTPS/trusted origin remains a future setup step if required.

Recommended local production path:

```text
C:\Dev\warehouse-it-inventory
```

Avoid running the active Next.js build from OneDrive or SharePoint synced folders. OneDrive can lock `.next`, generated Prisma files, and SQLite files while syncing. Keep OneDrive for backup copies or exports if useful, but avoid placing the live SQLite database and active build output in a volatile/synced folder when possible.

Move/copy checklist:

1. Stop the dev or production server.
2. Run `npm run backup`.
3. Copy the project folder to `C:\Dev\warehouse-it-inventory`.
4. Copy `.env`; do not commit it or print secret values.
5. Confirm `prisma/dev.db` exists.
6. Confirm `uploads/assets`, `uploads/stock`, `uploads/facturas`, and `uploads/maps` exist if photos, facturas, or maps have been uploaded.
7. Run `npm install` if dependencies are not present.
8. Run `npx prisma generate`.
9. Run `npm run doctor`.
10. Run `npm run build`.
11. Start with `npm run start`.

Safe copy helper:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\copy-to-local-dev.ps1
```

The copy helper writes to `C:\Dev\warehouse-it-inventory`, excludes `node_modules`, `.next`, build/cache folders, local logs, and local backups, and includes Git history by default. It does not copy `.env` unless you explicitly pass `-IncludeEnv`; copy `.env` manually or use `-IncludeEnv` only when you understand it contains secrets. The script is copy-only and does not delete the original OneDrive project.

After the copy:

```powershell
cd C:\Dev\warehouse-it-inventory
npm install
npx prisma generate
npm run doctor
npm test
npm run lint
npm run build
npm run backup
```

Daily local run modes:

- Development mode: `npm run dev`
- Production-like mode: `npm run build` then `npm run start`

Daily production-like start:

```powershell
cd C:\Dev\warehouse-it-inventory
npm run start
```

After code changes:

```powershell
cd C:\Dev\warehouse-it-inventory
npm install
npx prisma generate
npm run doctor
npm test
npm run lint
npm run build
npm run backup
npm run start
```

`npm run start` uses the built `.next` output. If a `.next` file lock appears, stop Node processes before rebuilding and verify the active project is not running from OneDrive.

Readiness and health:

- Run `npm run doctor` after moving folders, changing `.env`, restoring backups, or setting up a new workstation.
- Open `/api/health` to verify database reachability, writable backup/upload folders, scheduled job count, email configured state, and latest successful backup metadata.
- `/api/health` does not expose secrets.

Deployment checklist before daily use:

- Project moved out of OneDrive or OneDrive warning is understood.
- `npm run doctor` passes or warnings are accepted.
- `npm run build` passes.
- `npm run backup` works.
- Restore drill has been tested with database plus uploads.
- `/api/health` returns `ok` or only expected degraded warnings.
- Windows Task Scheduler is configured for scheduled jobs if automatic reminders are needed.
- Labels have been tested on real printer/scanner hardware.
- SMTP is configured or manual email skipped state is accepted.
- Real data backup exists.
- The user knows how to stop/start the app.

Before team rollout:

- Review authentication, roles, and active users.
- Review permission model.
- Automate backups and monitor job output.
- Test restore from a real backup.
- Do not enable a BitLocker vault until encryption, authentication, and authorization are ready.
- Choose a proper deployment host and HTTPS setup.

### Disabled Legacy UniFi/AP Notes

Older code paths and database tables for AP-based location sync are kept as disabled legacy placeholders because removing migrations/models would be risky. The default app does not require UniFi, does not configure UniFi credentials, does not call UniFi APIs, and does not enable UniFi/AP sync jobs. The legacy sync endpoint returns a disabled response unless `LEGACY_UNIFI_SYNC_ENABLED=true` is explicitly set for a controlled local test.

## Useful Commands

```bash
npm run lint
npm test
npm run build
npm run prisma:generate
npm run backup
npm run doctor
npm run jobs:run-due
```

Do not run `npm run prisma:seed` on a real/imported database. It deletes inventory data unless blocked by the required `ALLOW_DESTRUCTIVE_SEED=true` guard.

## Production Start

For internal production use, build once and run the optimized Next.js server:

```bash
npm install
npx prisma migrate deploy
npx prisma generate
npm run doctor
npm run build
npm start
```

By default, the app runs on port `3000`. For the controlled beta, keep `next start` on `127.0.0.1:3000` behind the LAN-only HTTPS reverse proxy and use `https://warehouse-it.local` as the preferred phone URL. Keep `http://192.168.0.67:3000` only as a fallback while DNS/certificate trust is being repaired.

Before Prisma migrations or schema changes, run `npm run backup`. Do not run `npm run prisma:seed` on real data unless you are intentionally resetting a development database and have set `ALLOW_DESTRUCTIVE_SEED=true`. The Phase 54 baseline records the existing real SQLite schema in `_prisma_migrations`, so future production updates should run `npx prisma migrate deploy` after backup and before `npx prisma generate`. SQLite is appropriate for local/small internal use; for multi-user/team production, consider Postgres later rather than stretching local SQLite beyond its comfort zone.

Production update rule:

1. Run `npm run backup`.
2. Pull the latest code.
3. Run `npm install`.
4. Run `npx prisma migrate deploy`.
5. Run `npx prisma generate`.
6. Run `npm run doctor`.
7. Run `npm run build`.
8. Restart the app.
9. Check `/api/health`.

## Main Pages

- `/dashboard` summary cards, category/range summaries, recent updates, and conflicts.
- `/workspace` lightweight IT Workspace hub for Quick Tasks, PO Tracker, and Resources.
- `/tasks` phone-first quick follow-up tasks.
- `/tasks/new` create a small IT action item tied to assets, employees, stock, facturas, or alerts.
- `/tasks/[id]` task detail with status actions.
- `/tasks/[id]/edit` update a task.
- `/po-tracker` lightweight purchase-order and vendor follow-up notes.
- `/po-tracker/new` create a purchase note and optional item rows.
- `/po-tracker/[id]` PO tracker detail with status actions.
- `/po-tracker/[id]/edit` update a purchase note.
- `/tools` internal Resources / IT Link Tree.
- `/tools/new` add a resource link.
- `/tools/[id]/edit` update or deactivate a resource link.
- `/intake` phone-first Inventory Intake hub for new inventory creation.
- `/intake/assets/new` single serialized asset intake with optional recommended photos.
- `/intake/assets/bulk` bulk serialized asset intake with preview, duplicate checks, and label/missing-photo next steps.
- `/intake/pair` pair existing companion devices, such as sleds with iPods/iPhones.
- `/intake/stock` receive quantity-based stock items or add quantity to an existing stock item with movement history.
- `/devices` searchable/filterable asset inventory with mobile cards and desktop table.
- `/devices/new` add an asset or reservation.
- `/devices/[id]` detail page with inventory, assignment, network, map, conflicts, scan history, and activity.
- `/employees` employee directory.
- `/employees/new` add an employee.
- `/employees/[id]` employee profile with assigned assets and assignment history.
- `/assignments` long-term equipment assignment records.
- `/assignments/new` phone-first assignment workflow with employee, assets, terms, and signature.
- `/assignments/[id]` assignment detail and signature receipt view.
- `/stock` consumables, peripherals, printer supplies, and spare parts.
- `/stock/issue` scan/select an employee or temporary borrower, scan/select stock, then hand out or loan quantity-tracked items.
- `/stock/issues` active stock loans, recent handouts, returned items, overdue loans, and temporary borrower issues.
- `/stock/issues/[id]` stock issue detail with linked movement history.
- `/stock/issues/[id]/return` return loaned stock and decide whether it goes back into usable quantity.
- `/stock/new` create a stock item.
- `/stock/[id]` stock detail with quantity actions, movement history, and linked maintenance.
- `/temporary-borrowers` temporary borrower list for contractors, visitors, and unregistered users.
- `/temporary-borrowers/new` create a quick temporary borrower ID.
- `/temporary-borrowers/[id]` temporary borrower detail with active loans and past issues.
- `/alerts` central alert center with open, acknowledged, resolved, and ignored alerts.
- `/jobs` scheduled local job status, run-now controls, and recent job runs.
- `/backups` local backup history, manifest review, and backup creation controls.
- `/zones` location zone configuration for AP grouping and fixed/static asset movement alerts.
- `/facturas` purchase records and attached factura files.
- `/facturas/new` create a factura and link assets or stock items.
- `/facturas/[id]` factura detail with linked assets, stock items, and stock movements.
- `/facturas/[id]/edit` update purchase details, attachment, and links.
- `/devices/[id]/maintenance/new` add cleaning, repair, inspection, supply replacement, or part replacement records.
- `/ranges` reserved pools with next-free-IP suggestion and reservation.
- `/ranges/new` create a reserved pool.
- `/scan` phone camera QR/barcode lookup and quick device actions.
- `/scanner` server-side scan form and recent scan history.
- `/map` warehouse floor map, location anchors, asset last known location pins, and last 5 location trails.
- `/map/ap-locations/new` configure map location anchors and coordinates.
- `/missing` assets marked missing with inventory and stored location context.
- `/conflicts` live conflict detection and suggested fixes.
- `/activity` history log.
- `/settings` defaults, scan limits, import/export.
- `/import/legacy-sheet` admin-only legacy Excel importer for old workbook migration.
- `/data-quality` focused post-import review for duplicate IPs, suspicious imported stock comments, suspicious asset names, missing required photos, skipped duplicate workbook rows, unlinked facturas, missing fields, static/network assets, mobile devices, stock, and ImportRun audit files.
- `/photos/compliance` phone-first queue for missing recommended asset photos, thumbnail health, oversized photo review, and storage size signals.
- `/rma` phone-first RMA / repair batch list with active, sent, returned, closed, cancelled, and follow-up due filters.
- `/rma/new` create an RMA case, select multiple devices, and send them to repair.
- `/rma/[id]` RMA detail with destination, tracking, follow-up, device list, item results, and activity.
- `/rma/[id]/edit` update RMA details or add more devices.
- `/loans` phone-first serialized asset checkout list with active and overdue views.
- `/loans/new` create a temporary checkout for specific serialized devices.
- `/loans/[id]` loan detail with borrower, dates, device list, and item return states.
- `/loans/[id]/return` receive one or more checked-out assets.
- `/rma/[id]/receive` receive one or more returned devices and update their repair result.
- `/rma/active` shortcut to active repair batches.

## CSV Import/Export

Use `/settings` for CSV tools.

Workspace export types include `tasks`, `po-tracker`, and `tool-links`. These are export-only additions for this phase; CSV import for the workspace module is intentionally not included.

RMA export types include `rma-cases` and `rma-items`. These are export-only and are meant for repair follow-up lists, vendor summaries, or manual audit files.

Stock counter export types include `stock-issues` and `temporary-borrowers`.

Device import headers can include:

```csv
name,category,ipAddress,macAddress,vlan,status,location,brand,model,serialNumber,assignedTo,notes
```

Range import headers can include:

```csv
name,category,vlan,subnet,startIp,endIp,location,notes,active
```

Stock item import headers can include:

```csv
name,sku,category,itemType,quantityOnHand,minimumQuantity,vendorName,storageLocation,unitCost,currency,notes
```

Valid stock item types are `CONSUMABLE`, `PERIPHERAL`, `SPARE_PART`, and `SUPPLY`. Valid stock categories include `KEYBOARD`, `MOUSE`, `HEADSET`, `CABLE`, `ADAPTER`, `TONER`, `INK`, `THERMAL_LABEL`, `RIBBON`, `BATTERY`, `PRINTER_PART`, `MAINTENANCE_KIT`, and `OTHER`.

Imports preview rows before saving, validate IPs and stock quantities, and check duplicate device IPs or stock SKUs.

## Legacy Excel Import

Use `/import/legacy-sheet` only for the old `Inventario Tech 2.0` workbook migration. New inventory should be created through `/intake`, which is the normal source-of-truth workflow for single assets, bulk serialized assets, and stock receiving. Legacy Import remains Admin-only.

This importer is separate from CSV import because it needs sheet detection, flexible legacy headers, workbook-specific tab mapping, dry-run validation, duplicate detection, and an audit log.

To prepare a Google Sheet source, export it as Microsoft Excel `.xlsx`. Put sample workbooks under `Import-samples/` for local testing, then upload the `.xlsx` from the importer page. Uploading and previewing do not write records.

Before final import, back up:

- `prisma/dev.db`
- `uploads/assets`
- `uploads/facturas`

The importer will not proceed with final save until the backup confirmation checkbox is selected.

### Legacy Tab Mapping

Asset tabs include `Sled`, `iPod`, `iPhone`, `iPad`, `Tablet`, `Laptop`, `Desktop`, `Monitor`, `IMPF`, `IMPT`, `Scale`, `Scanner`, `Zebra Base`, `Zebra Scanner`, `ChargerBays`, `PortHubs`, `Teclado+Mouse`, `Mouse`, `Infraestructura`, and `Seguridad`. `ScannerBK` is detected but ignored by default because `Scanner` appears to be the cleaner current tab.

Stock/consumable tabs include `Otros`, `Baterias`, `Arm Display Base`, and `Consumibles`. Factura linking uses `ImpInvoice` plus invoice/factura columns across asset tabs. IP fields are read from `IMPF`, `IMPT`, and `Scale`; the `IPs` tab is previewed as candidate IP data only because its range mapping is not clear enough to blindly create ranges.

Future legacy previews skip obvious stock comment/task rows such as `Falta crear iPhone J136` when they have no meaningful quantity, vendor, SKU, serial, factura, or location. These skipped rows are counted as warnings so they are visible during preview instead of becoming bogus stock records.

Laptop rows now prefer `Brand + Model` for the display name when available. This prevents bad legacy values such as `ACCESS POINT GHT-LP-1` from becoming the asset name for Dell Latitude laptop records. Real infrastructure/AP rows can still use `ACCESS POINT` when the row is actually an access point.

Helper tabs ignored by default include `Hoja 42`, `Validate IP`, `DBTAG`, and `CleanSN`.

### Duplicate Handling

Asset duplicate detection checks, in order: asset tag, serial number, MAC address, then IP address as warning-only. Existing assets are previewed as updates and the importer only updates mapped inventory fields; it does not delete or replace photos, assignments, signatures, maintenance, stock movements, alerts, tasks, PO notes, facturas, or activity logs.

Stock duplicate detection checks SKU first, then name plus category. Facturas are matched by factura number, and `ImpInvoice` rows try to link facturas to assets by serial number.

### Safety Rules

Legacy notes are scanned for credential-looking values such as password, pass, token, or API key. Matching values are redacted before save and the row receives a warning. Plaintext credentials should never be stored in inventory notes.

iPod, iPhone, iPad, phones, and tablets are inventoried without requiring IP or MAC data. They do not enable static IP tracking, movement alerts, offline alerts, or network scanning by default.

Scale rows can import IP addresses and may enable static/fixed-asset tracking when a valid IP is present. This does not use UniFi and does not add UniFi integration.

## Data Quality Review

Use `/data-quality` after a legacy import to review cleanup items safely inside the app. The page is a focused import review dashboard, not a full reporting module. It does not auto-fix records or import skipped rows.

The top urgent section shows duplicate active IPs, invalid IPs, exact duplicate asset tags/serials, and any mobile device network-tracking violations. Duplicate IPs mean the same IP is assigned to more than one active/non-retired asset; open the affected assets or create a Quick Task for manual review.

Skipped duplicate workbook rows are rows the importer intentionally did not save because their asset tag or serial was already seen earlier in the workbook. The review page shows source sheet, row number, duplicate reason, duplicate key when available, and the first kept row reference. The duplicate CSV remains in the timestamped backup folder, for example `backups/pre-import-20260529-080303/legacy-preview-duplicate-report.csv`.

Unlinked facturas are purchase records with no linked assets or stock items. Open each factura and link assets/stock only when the match is clear. Stock-factura linking from the legacy workbook is intentionally review-only for now.

Suspicious stock/comment rows are stock records whose names look like legacy comments or tasks, especially names such as `Falta crear iPhone J136`, `Pendiente`, `Crear`, `Revisar`, `TODO`, or `Need to create`. The page shows the reason, source sheet/row when available, and an export named `suspicious-stock-comments`. Cleanup is archive-only, never hard delete. The archive action is only available when the item is unused, quantity is `0`, and it has no SKU, vendor, storage location, factura, stock movements, maintenance usage, active issue/loan, or purchase-note link.

Suspicious asset names flag laptop/mobile/desktop records that appear to have bad legacy display names, such as `ACCESS POINT GHT-LP-1` on a Dell Latitude laptop. The suggested correction uses `Brand + Model`, for example `DELL Latitude 3520`, and only changes the display name after confirmation. Asset tag, serial, status, assignment, loan/RMA history, facturas, photos, stock, and activity history are not changed.

Photo Compliance / Missing Required Photos shows assets missing recommended audit photo types. All serialized assets are checked for overview, asset tag, serial label, and condition photos. Fixed/static assets such as printers, scales, desktops, cameras/NVRs, switches, and access points also need a location/installed photo. Damaged assets may need a damage photo, and RMA/return history can add RMA or return condition review items. These are review-only and do not block workflows.

Static/network review covers thermal printers, MFP printers, scales, desktops, cameras/NVRs, switches, APs, and other fixed/static candidates. It shows counts with IP, with MAC, missing IP, missing MAC, static tracking candidates, expected location presence, scale details, and printer details. It does not automatically enable tracking for every asset.

Mobile Apple and tablet review confirms that iPods, iPhones, iPads, phones, and tablets are imported as inventory assets without default IP/MAC/network tracking. If a mobile device later has IP or tracking enabled, it appears as a violation to review.

Mobile legacy cleanup separates old mobile labels from real employee assignments. Legacy values such as `TFGTI_iPodK130`, `GHT-SLD-*`, `NO ASIGNADO`, and similar asset-like assigned values are treated as aliases or pairing review data, not people. `DeviceAlias` stores old labels such as OLD A/N, Label DB, Last Label, and import references. `DeviceRelationship` stores confident iPod/iPhone to sled pairings. Use `npm run cleanup:mobile-pairings:dry-run` first, review the counts, run `npm run backup`, then use `npm run cleanup:mobile-pairings:apply` only for safe cleanup. The cleanup does not delete employees, assignment history, signatures, loans, RMA history, photos, facturas, or activity history.

Import audit files from the controlled first import are stored under the pre-import backup folder:

- `legacy-preview-warning-report.csv`
- `legacy-preview-duplicate-report.csv`
- `legacy-import-result.json`
- `legacy-post-import-audit.json`

The Data Quality page shows the latest ImportRun, warning count, skipped duplicate count, redaction count, and the backup folder paths for these audit files.

Asset Value / Depreciation review flags active assets missing purchase value, missing purchase date, or stale internal estimates. These values are for IT lifecycle context and decommission snapshots only, not accounting. Use the asset detail `Asset Value` card or `/devices/[id]/value` to edit permitted records.

Factura Line Items / Value Matching shows structured invoice rows that need asset links or value application. Add line items from a factura detail page, or use the assisted `/facturas/[id]/extract` workflow for selectable-text PDFs or CFDI XML. PDF extraction runs locally with `pdftotext` when available, returns editable candidates only, and never creates line items, links assets, or applies asset values until the user explicitly confirms. Scanned/image-only PDFs should be entered manually until OCR is added in a future phase. XML extraction is preferred when the provider supplies CFDI XML because Concepto rows are exact.

Focused CSV exports are available from the page for duplicate IP review, suspicious stock comments, suspicious asset names, suspicious assignments, mobile pairing review, device aliases, missing required photos, asset value review, factura line item review, skipped duplicate workbook rows, unlinked facturas, missing asset tags, missing serial numbers, static assets missing IP/MAC, mobile device tracking violations, and stock review.

## RMA / Repair Workflow

Use `/rma` to track repair batches such as sending iPods, iPhones, iPads, scanners, or printers to a vendor or USA repair destination under one RMA number.

For an RMA #14 style batch:

1. Open `/rma/new`.
2. Enter the RMA number, destination, vendor, carrier/tracking, sent date, reminder days, and notes.
3. Search and select multiple devices by asset tag, serial, IMEI, name, model, category, employee, or status.
4. Review the selected devices and create the RMA.

When an RMA is created as `Sent` or `Active`, selected devices move to `In Repair/RMA`. Assignment history is preserved. If a selected device is currently assigned, the form shows a warning that sending it to RMA makes it unavailable while keeping the historical assignment record.

Mobile Apple and tablet devices remain inventory-tracked only. RMA does not add IP, MAC, static tracking, movement alerts, offline alerts, or network monitoring to iPods, iPhones, iPads, phones, or tablets.

Use `/rma/[id]/receive` to receive returned devices. Each pending item can be marked repaired, returned as-is, replaced, rejected, lost, or retired with a return condition and notes. Receiving all items marks the RMA returned; receiving only some items marks it partially returned. Device history and RMA item history remain linked.

RMA reminders use the existing Alert Center and manual alert refresh model. The app can create/update RMA follow-up alerts when an RMA reaches its expected follow-up date, stays active past the reminder window, or becomes overdue. Duplicate RMA reminder alerts are suppressed for the same RMA and reminder type.

RMA shortcuts appear on asset detail pages and Quick Scan results. Assets in an active RMA show a Current RMA card with links to open the case or receive the asset. Assets not in RMA can start a new repair batch from the asset page or scan result.

This workflow intentionally does not sync with vendors, create labels, add loans/checkouts, or auto-retire/auto-clear assignment records. RMA detail pages can send manual RMA sent, follow-up, and closed summary emails when SMTP is configured.

## Serialized Asset Loans / Checkouts

Use `/loans` for temporary checkout of specific serialized devices, such as loaning a particular scanner, laptop, iPod, iPhone, iPad, scale, or other individually tracked asset.

This is different from:

- Assignments: long-term ownership or responsibility for serialized assets.
- Stock issues: quantity-based handouts or loans for generic stock like keyboards, mice, cables, batteries, and headsets.

Create a loan from `/loans/new`, an asset detail page, Quick Scan, an employee detail page, or a temporary borrower detail page:

1. Choose an employee or temporary borrower.
2. Set checkout and expected return dates.
3. Search/select one or more serialized assets by tag, serial, model, name, or employee.
4. Record condition/accessories out, optional terms, optional signature, and notes.
5. Create the loan.

Starting a loan moves selected devices to `Loaned Out`. Assignment history is preserved. If a selected asset is already assigned, the form shows a warning and requires confirmation; it does not silently clear the assignment.

Use `/loans/[id]/return` to receive assets. Good/Fair returns move the device back to `Available`. Damaged, Not Working, and Missing Accessories returns move the device to `In Repair/RMA` for review. Lost returns mark the device `Lost`. Partial returns keep the loan `Partially Returned`; returning all items closes it as returned, damaged, or lost depending on item outcomes.

Quick Scan shows active loan context for scanned assets, plus actions to open or return the loan. Employee and temporary borrower scan results show active serialized asset loan counts and a shortcut to create a loan.

CSV exports are available as `asset-loans` and `asset-loan-items`.

Limitations in this phase:

- QR label generation is not implemented.
- Loan print forms are not implemented.
- This does not replace assignments or stock issue loans.

## IT Workspace

The IT Workspace is a small internal hub for the warehouse IT work that does not need a full service-desk workflow. It keeps quick follow-ups, purchase notes, and common links near the inventory records they reference while staying phone-first for floor walks.

### Quick Tasks

Use `/tasks` for simple action items such as replacing a printhead, checking a scale, following up on a missing scanner, ordering toner, or reviewing a warranty issue. Tasks support status, priority, category, due/reminder dates, an assignee text field, notes, and optional links to assets, employees, stock items, facturas, or alerts.

Task cards are designed for phone use: search and filters stay at the top, cards show only the key context, and the main actions are `Open`, `Mark done`, and `Edit`. Asset, stock, factura, alert, and scan views include lightweight task creation shortcuts where they are useful.

### PO Tracker

Use `/po-tracker` for purchase-order notes and vendor follow-ups that are too lightweight for a purchasing system. A PO tracker note can hold a PO number, title, vendor, status, priority, dates, estimated amount, related factura, notes, and optional requested item rows linked to stock items or assets.

The PO Tracker is informative tracking only. It does not implement approvals, procurement automation, email, RMA workflows, scheduled follow-ups, or vendor integrations. Stock detail pages can start a PO note, and factura detail pages can show related PO notes.

### Resources / IT Links

Use `/tools` as an internal IT link tree for dashboards, portals, SOPs, vendor pages, documentation, and support sites. Links can be categorized, favorited, marked as VPN required, marked as internal only, or deactivated.

Resources store links only. Do not store passwords, API keys, tokens, secrets, or recovery details in link notes. If credentials are required, link to the approved password manager entry or SOP instead.

Links are not integrations. For example, a UniFi Network resource may point to the UniFi web UI, but the workspace module does not add UniFi API calls or expand the existing read-only UniFi behavior.

## Stock, Supplies, And Maintenance

The app now distinguishes between:

- Assets: serialized equipment tracked individually, such as laptops, scanners, printers, APs, switches, cameras, and NVRs.
- Stock items: quantity-tracked consumables, peripherals, supplies, and spare parts such as keyboards, mice, headsets, toner, labels, ribbons, printheads, rollers, fusers, and maintenance kits.
- Maintenance records: service history tied to an asset, optionally linked to stock items used during the work.

Generic keyboards, mice, headsets, cables, adapters, batteries, and chargers should normally stay as `StockItem` quantity, not one `Device` per physical item. Only create a `Device` when the item is serialized and should be tracked individually.

### Generic Stock Barcodes

Each stock item can have a `Scan code`, separate from SKU. Examples:

```text
KEYBOARD
MOUSE
HEADSET
STOCK:KEYBOARD
STOCK:MOUSE
```

Quick Scan and `/stock/issue` can match stock by scan code, SKU, or name. QR/barcode label generation is not implemented yet; this phase only supports matching scanned values that already exist on the stock item.

### Issue Or Loan Stock

Use `/stock/issue` for the warehouse counter flow:

1. Scan or select the employee. The lookup checks employee ID, name, and email.
2. If the person is not registered, create a temporary borrower.
3. Scan or select the stock item by scan code, SKU, or name.
4. Choose `Handout` or `Loan`.
5. Confirm quantity, normally `1`, plus notes or expected return date.

Handouts decrease stock quantity and create a `StockIssue`, `StockMovement`, and `ActivityLog`. Handouts are recorded as closed/completed because the item is not expected back.

Loans decrease stock quantity and remain active until returned. They can be issued to an employee or a temporary borrower. Temporary borrowers are for contractors, visitors, temporary workers, or users not yet in the Employees table. Convert/merge into Employee is left for a future phase.

### Return Loaned Stock

Use `/stock/issues/[id]/return` from the issue detail, employee detail, temporary borrower detail, or stock issue list.

Return conditions:

- `Good` and `Fair` increase usable stock quantity.
- `Damaged`, `Not Working`, and `Missing` do not increase usable stock by default.

Partial returns mark the issue `Partially Returned`. Full returns mark it `Returned`. Every return creates movement history and an activity log entry.

Limitations in this phase:

- Serialized asset loans/checkouts are handled separately under `/loans`.
- QR label generation is not implemented.
- This does not change the existing asset assignment workflow.

### Add Stock

Open `/stock/new` and create the item with a category, item type, quantity on hand, minimum quantity, vendor, storage location, and optional compatible asset category/model notes.

Each stock detail page has quantity actions:

- Add stock after a purchase or delivery.
- Remove stock for damage, shrink, or disposal.
- Adjust quantity after a physical count.
- Hand out a peripheral or consumable to an employee.
- Return an item to stock.

Every quantity change creates a `StockMovement` row with previous quantity, new quantity, reason, notes, employee, and timestamp.

### Use Stock For Printer Maintenance

Open an asset, then select `Add maintenance`.

You can record:

- Cleaning
- Preventive maintenance
- Toner, ink, drum, or fuser replacement
- Printhead, platen roller, cutter, or power supply replacement
- Repair, inspection, or other service

If a stock item and quantity are selected, the app decreases stock, creates a stock movement, creates the maintenance record, and logs activity. Stock cannot be reduced below zero.

### MFP Supply Alerts

MFP printers support manual supply fields:

- Black, cyan, magenta, and yellow toner/ink level
- Drum level
- Fuser or maintenance kit status
- Page count / meter reading
- Last supply replacement date
- Low supply threshold

Alerts are generated when a configured percentage is at or below the threshold. Toner/ink alerts are not generated for thermal printers.

### Thermal Printer Maintenance Alerts

Thermal printers support:

- Last cleaned date
- Cleaning interval days
- Last printhead, platen roller, and cutter replacement dates
- Estimated printhead life
- Maintenance due date
- Maintenance notes

Alerts are generated when cleaning or maintenance is due. Thermal maintenance alerts are not generated for MFP printers unless normal maintenance due fields are configured for them later.

## Alert Center

The `/alerts` page is the central operational alert center. It shows open, acknowledged, resolved, and ignored alerts with filters for severity, status, type, source, asset, and date context.

Alert rows/cards show:

- Title and message
- Severity
- Source
- Related asset or stock item
- First seen and last seen
- Status
- Actions to acknowledge, resolve, ignore, add a resolution note, open the asset, or open the map for location-related alerts

Duplicate suppression is enabled from Settings. When the same alert is detected again, the app updates `lastSeenAt` and metadata instead of creating another row.

### Manual Alert Refresh

Manual refresh is available from the alert center or through this endpoint:

```http
POST /api/alerts/refresh
```

It refreshes:

- Stock and low inventory alerts
- Printer maintenance and MFP supply alerts
- IPAM conflict alerts
- Warranty and factura warranty alerts
- Missing asset seen online alerts
- Fixed/static-IP movement alerts
- RMA follow-up and overdue reminders

The response includes:

- `alertsCreated`
- `alertsUpdated`
- `alertsResolved`
- `alertsSkipped`
- `errors`

Scheduled jobs can now run these checks automatically. Manual refresh is still useful after imports, inventory edits, maintenance updates, stock adjustments, or warranty updates when you want immediate results.

### Conflict Alerts

Conflict alerts are created from the existing IPAM conflict logic:

- Duplicate IP
- Duplicate MAC
- IP outside assigned range
- VLAN mismatch
- Unknown active IP when available
- Asset marked available but seen online

If a conflict disappears, resolve the alert manually unless auto-resolution is clearly safe for the workflow. Activity is logged when alerts are created, updated, acknowledged, resolved, or ignored.

### Stock And Printer Alerts

Stock and printer alerts appear in `/alerts` as first-class alerts:

- `LOW_STOCK`
- `MFP_LOW_TONER`
- `MFP_LOW_INK`
- `MFP_DRUM_LOW`
- `THERMAL_CLEANING_DUE`
- `THERMAL_MAINTENANCE_DUE`
- `PRINTHEAD_REPLACEMENT_DUE`
- `PLATEN_ROLLER_REPLACEMENT_DUE`

Thermal printers do not receive toner/ink alerts. MFP printers do not receive thermal cleaning alerts unless future manual configuration explicitly opts them in.

### Warranty Alerts

Warranty alerts can be enabled in Settings. The default threshold is 60 days.

The app creates alerts when:

- An asset warranty expiration date is within the threshold.
- A linked factura/purchase warranty end date is within the threshold.

Example:

```text
Warranty expiring soon
Dell Latitude 5550 asset LAP-001 warranty expires in 28 days.
```

### Location Zones

Use `/zones` to define logical warehouse areas such as Receiving, Packing, Shipping, Returns, Office, or IT Cage.

Then edit map location anchors from the map admin flow and assign anchors to zones when useful. A zone groups expected location areas; it is not a precise map polygon.

To configure fixed/static movement alerts:

1. Create zones in `/zones`.
2. Assign AP markers to zones from the AP location edit page.
3. Edit a fixed/static asset.
4. Enable `Fixed/installed asset` or `Uses static IP`.
5. Set `Expected location zone`.
6. Enable `Movement alerts`.
7. Run alert refresh from `/alerts`.

Zone detail pages show APs in the zone, assets expected in the zone, and recent movement alerts.

### Fixed / Static-IP Movement Alerts

Movement alerts are intentionally narrow. They are for installed or static equipment, not normal mobile devices.

Movement alerts are evaluated only when:

- `movementAlertsEnabled` is true.
- The asset is marked fixed/installed or uses a static IP.
- An expected location zone is set.
- Legacy AP sync data exists and `LEGACY_UNIFI_SYNC_ENABLED=true` is explicitly configured.

No movement alert is created for:

- Handheld scanners
- Laptops
- Phones
- Tablets
- Loaner or temporary equipment
- Assets not marked fixed/static
- Assets with movement alerts disabled

An alert is created when the latest AP zone differs from the expected zone. For example, a thermal printer expected in Packing but last seen on a Shipping AP creates a `FIXED_ASSET_MOVED` alert.

If duplicate suppression is enabled, the same asset/type/actual-zone alert updates the existing open alert instead of creating duplicates. Settings also include an option to auto-resolve movement alerts when the asset returns to the expected zone.

### Equipment Install / IP Commissioning

Use `/devices/[id]/install` for fixed/static equipment such as printers, scales, desktops, cameras/NVRs, switches/APs, and other intentionally network-tracked assets. Asset detail pages and Quick Scan show `Install / Commission` or `Update Installation` when the asset is eligible.

The install flow records:

- Area and location/station
- IP address
- MAC address
- VLAN or selected IP range
- Static/fixed asset flags
- Install notes

MAC addresses can be entered as `AA:BB:CC:DD:EE:FF`, `AA-BB-CC-DD-EE-FF`, or `AABBCCDDEEFF`; the app stores the normalized colon format. The optional Detect MAC action uses the local server's ARP/neighbor cache and is best effort only. It can fail when the device is offline, on another VLAN, blocked, or not visible from the server, so manual MAC entry remains the reliable path.

The flow checks for duplicate IPs, duplicate MACs, IPs outside the selected range, bad status states, and ineligible mobile assets. Confirming installation updates only install/network fields and status; it preserves asset tags, serials, photos, facturas, assignment history, loan history, RMA history, and activity history. iPods, iPhones, iPads, phones, and tablets do not show install actions by default unless they were intentionally marked static/network-tracked.

### Missing Asset Seen Online Alerts

Legacy missing-asset online alerts are disabled by default because UniFi/API sync is unavailable. If legacy AP sync is explicitly enabled for a controlled local test, the app can still create `MISSING_ASSET_SEEN_ONLINE` alerts from local sync payloads.

### Map And Quick Scan Alert Context

The map shows alert context for location-related asset pins, including expected zone, actual zone, severity, and links back to the asset or alert. Quick Scan also shows open alerts, conflict status, warranty context, last known location, and map actions for scanned assets.

### Map Uploads And Location Anchors

Use `/map` to upload a warehouse map image through the app. Uploaded maps are stored under `uploads/maps` and served through protected `/uploads/maps/[filename]` routes with path-traversal checks and content-type validation. PNG, JPG, WebP, and safe SVG files are supported. Manual public image paths remain available only as an advanced fallback for old maps.

Location anchors are percent-based points on the selected map. Use the anchor editor to tap/click the map, set area/department/station, and keep manual location text intact. Anchors can be used during Move / Relocate and physical audit setup, but selecting an anchor does not automatically change asset status, assignment, loan, RMA, IP, MAC, or VLAN data.

### Alert Limitations

Current limitations:

- AP-based location is approximate. It is not GPS, triangulation, or exact indoor positioning.
- UniFi sync data can be stale or incomplete.
- Movement alerts depend on correctly mapped AP zones and expected zones.
- Wired/static devices may not have UniFi Wi-Fi association data.
- Toner and ink levels are manual until future SNMP/printer integration is added.
- Thermal printer maintenance is schedule/manual-history based.
- Stock counts depend on users recording usage accurately.
- Factura file matching is manual; there is no OCR or automatic vendor/line-item extraction yet.

## Scheduled Jobs

The `/jobs` page manages local scheduled checks for the app. These jobs use existing local database data only. They do not add new UniFi API integration, API keys, UniFi local admin login, or UniFi write actions.

Default schedules:

- Alert refresh every 15 minutes
- RMA reminder refresh every 60 minutes
- Asset loan overdue check every 60 minutes
- Stock loan overdue check every 60 minutes
- Stock alert check every 60 minutes
- Printer maintenance check every 12 hours
- Warranty check daily
- Data integrity check daily

Default jobs are created only when missing, so repeated app starts or script runs do not create duplicates. Existing older schedules are preserved if they already exist in the database.

Each job stores:

- Enabled/disabled state
- Interval in minutes
- Last run time
- Next run time
- Last status and error
- Recent `JobRun` history

Manual controls:

- Open `/jobs` and select `Run due jobs`.
- Open `/jobs` and select `Run now` for an individual job.
- Call `POST /api/jobs/run-due`.
- Call `POST /api/jobs/:id/run-now`.
- Call `GET /api/jobs` to list schedules with recent runs.
- Call `PATCH /api/jobs/:id` to enable/disable a job or adjust its interval.

Local command:

```bash
npm run jobs:run-due
```

The command runs due jobs directly against the local SQLite database. Keep the normal app server running separately for users.

`POST /api/jobs/run-due` and `npm run jobs:run-due` both use the same server-side runner. The response includes:

- `jobsChecked`
- `jobsDue`
- `jobsRun`
- `jobsSucceeded`
- `jobsFailed`
- `jobsSkipped`
- Per-job results and summaries

### Windows Task Scheduler

For an internal Windows PC/server, create a scheduled task that runs every 5 minutes.

Recommended cadence is every 5 or 15 minutes depending on how quickly reminders should refresh.

Recommended action:

```text
Program/script:
C:\Program Files\nodejs\npm.cmd

Add arguments:
run jobs:run-due

Start in:
C:\Dev\warehouse-it-inventory
```

Optional log-friendly argument:

```text
/c "cd /d C:\Dev\warehouse-it-inventory && npm.cmd run jobs:run-due >> logs\jobs-run-due.log 2>&1"
```

If using the optional log form, set Program/script to `C:\Windows\System32\cmd.exe` and make sure the `logs` folder exists. The working directory must be the project folder so `.env`, Prisma, and SQLite paths resolve correctly.

If the project is still in the current OneDrive folder, use that folder as `Start in`, but the production recommendation is to move the app outside OneDrive to avoid file locks:

```text
C:\Dev\warehouse-it-inventory
```

Task Scheduler settings:

- Run whether user is logged on or not.
- Run with highest privileges if the server policy requires it.
- Trigger every 5 minutes.
- Stop the task if it runs longer than 10 minutes.
- Do not start a new instance if the task is already running.
- Do not configure multiple overlapping job runner tasks unless there is a specific reason.

The app also has a database-level `running` lock on each job to avoid duplicate job runs.

### Scheduled Job Safety

Scheduled jobs intentionally do not:

- Call new UniFi API endpoints.
- Authenticate to UniFi.
- Modify UniFi clients, VLANs, APs, switch ports, firewall rules, Wi-Fi networks, or controller settings.
- Mark assets offline just because ping or network data is missing.
- Send automatic email from scheduled jobs; workflow receipt emails remain manual-first unless an Admin explicitly enables the matching auto-send setting.
- Send labels directly to printers.
- Auto-fix imported data, orphaned loan statuses, duplicate IPs, or retired-phone IP/MAC review items.

Scheduled jobs can:

- Create/update Alert Center reminders for RMA follow-up, overdue asset loans, overdue stock loans, low stock, printer maintenance, and warranty checks.
- Mark active serialized asset loans overdue when the return date has passed.
- Record stock loan overdue alerts while leaving stock issue status unchanged.
- Run data integrity checks and store summaries in `JobRun`.
- Suppress duplicate operational alerts by updating matching open alerts.

If one job fails, the runner logs a failed `JobRun`, updates the schedule error, continues with the next due job, and records activity.

## QR / Barcode / Data Matrix Asset Labels

Open `/labels` to generate lookup labels for inventory assets.

Supported modes:

- Existing assets: search/filter assets and export labels for matching asset tags.
- Alias-linked labels: select existing assets, generate physical codes such as `J01` to `J05`, and apply them as `PHYSICAL_LABEL` or `SCAN_CODE` aliases. The official asset tag remains unchanged.
- Range / pattern: generate labels such as `J001` to `J100`, `Zebra-208` to `Zebra-250`, or `GHT-LP-001` to `GHT-LP-100`.
- Batch sheet: generate free labels such as `K01` to `K24`, `J001` to `J100`, or up to 1,000 pattern labels. Batch labels can print one visible value while encoding another scan value, for example visible `J-192` and encoded `Zebra-J192`.
- Manual list: paste one asset tag per line; blanks are ignored and duplicates are removed.
- Calibration: open `/labels/calibration` to generate small sample-only test packs for Zebra printer/scanner tuning. Calibration does not create aliases or modify inventory.

Label safety rules:

- The primary QR/barcode encodes only the asset tag, such as `GHT-LP-011`.
- Batch labels keep `visibleText` and `encodedValue` separate. The visible text is what people read; the encoded value is what Quick Scan receives.
- In alias-linked mode, the QR/barcode can encode the physical label code, such as `J01`, while printing the official asset tag separately as reference text.
- Serial number can be printed as text and, if enabled, as a separate secondary QR code labeled as serial.
- Asset tag and serial are never concatenated into one code.
- Do not encode BitLocker recovery keys, passwords, employee names, private notes, factura details, SMTP/config values, or credentials.

Physical label aliases:

- `PHYSICAL_LABEL` is for the visible label code on the asset, for example `J01`.
- `SCAN_CODE` is for alternate scan-only codes that should resolve through Quick Scan.
- Quick Scan searches asset tags, serials, and aliases. If `J01` is linked to `GHT-SLD-1`, scanning `J01` opens the linked asset and shows the official tag.
- Data Quality includes CSV review for duplicate physical label aliases so the same physical code is not accidentally linked to multiple assets.

Sled display cleanup:

- Imported `GHT-SLD-*` records are displayed as Sled assets even though the current database category remains `OTHER`.
- Future Sled workbook rows use a `Sled GHT-SLD-*` display name instead of `OTHER GHT-SLD-*`.
- Data Quality includes a sled category/display review export for sled records that should be manually reviewed before any future dedicated Sled category is added.

Zebra export:

- Use **Download ZPL** on `/labels` or on an asset detail page.
- The `.zpl` output uses Zebra-native commands including `^BQN` for QR, `^BC` for Code 128 barcode, and `^BX` for Data Matrix.
- Test on blank/sample labels first using Zebra Setup Utilities, your Zebra driver/tooling, or another approved manual ZPL send method.
- Direct printer sending is intentionally not implemented in this phase.

Label calibration workflow:

1. Open `/labels/calibration`.
2. Choose a test pack: Micro Device, Scanner / Sled, Batch Sheet, or Standard Asset.
3. Choose DPI, physical size preset, code type, and template.
4. Download ZPL or open the print-friendly view.
5. Print on sample labels first.
6. Scan with the Zebra scanner and, if useful, a phone camera.
7. Confirm the expected scanner output shown on the page.
8. Adjust printer driver darkness/density and template choices before production labels.

Calibration guidance:

- Data Matrix is recommended for tiny iPod/sled labels.
- QR is usually easier for phone camera scanning, but needs more space.
- Code 128 is useful for traditional barcode scanners, but needs more width.
- Visible text may intentionally differ from encoded value, such as visible `J-192` with scanner output `Zebra-J192`.
- The app does not force Zebra darkness globally. Tune density in Zebra tools or printer driver settings.
- Calibration packs are intentionally small: 5, 10, or 24 labels depending on pack.

Print/PDF:

- Use **Print view** from `/labels` for browser printing or saving as PDF.
- Batch sheet print view uses a compact sheet layout and avoids rendering hundreds of heavy preview codes in setup mode. Export ZPL for Zebra-native Data Matrix output.
- Dedicated PDF generation is not implemented yet to avoid extra printing dependencies.

Every asset detail page shows an **Asset Label** section when an asset tag exists. Assets without an asset tag show a safe empty state instead of generating a label.

## Email Notifications And Receipts

Email support is SMTP-based and manual-first. Records are always saved first; email is attempted separately. If SMTP is missing or a send fails, the workflow record remains saved and the email attempt is logged as `SKIPPED` or `FAILED`.

Configure SMTP in `.env`:

```env
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
MAIL_FROM=
MAIL_REPLY_TO=
IT_NOTIFICATION_CC=
APP_BASE_URL=
IT_ASSIGNMENT_CC=
IT_LOAN_CC=
IT_RMA_CC=
IT_STOCK_CC=
```

`SMTP_FROM` is preferred for the sender address; `MAIL_FROM` is still accepted as a fallback. Specific CC values fall back to `IT_NOTIFICATION_CC` when blank. `APP_BASE_URL` is used for links back to records. The SMTP password is never shown in the browser, health payload, doctor output, or `EmailLog`.

Open `/settings` as an Admin to see sanitized SMTP status and send a test email. If SMTP is missing, the test creates a clear skipped result instead of crashing the app. Use a QA recipient first; do not send to real employees until recipients and templates are verified.

Manual email buttons are available on:

- Assignment detail: assignment receipt and return confirmation when returned items exist.
- Asset loan detail: checkout receipt and return confirmation when returned items exist.
- Stock issue detail: handout/loan receipt and return confirmation when returned quantity exists.
- RMA detail: sent summary, follow-up reminder, and closed summary when returned/closed.

Admin-controlled auto-send settings are available under `/admin/email-notifications` for assignment receipts, asset loan receipts, stock issue receipts, RMA emails, return confirmations, and overdue reminder emails. These settings default to off; when they are off, creation workflows return a clear skipped email result and the saved record is not affected.

Recipient behavior:

- Employees use `Employee.email` when available.
- Temporary borrowers use `TemporaryBorrower.email` when available.
- RMAs use `RmaCase.contactEmail` when available.
- Every send panel allows a manual recipient override.
- Missing recipients are logged as skipped with a clear message.

`EmailLog` records type, recipient, CC, subject, status, error message, message id, related record ids, and creation date. It records successful, failed, and skipped attempts.

Auto-send is intentionally not enabled in this phase. Scheduled jobs continue to create/update alerts only; they do not send overdue reminder emails automatically. This avoids accidental spam while testing real production-like data.

Troubleshooting:

- `Email not configured`: set at least `SMTP_HOST` and `SMTP_FROM` or `MAIL_FROM`.
- Authentication failed: check `SMTP_USER`, `SMTP_PASS`, port, and `SMTP_SECURE`.
- Company SMTP blocked: check firewall/network rules and whether outbound SMTP is allowed. Common ports are `587` with STARTTLS, `465` with SSL, and `25` for an internal relay.
- Employee has no email: enter a manual recipient in the send panel or update the employee record.
- Links point to localhost: set `APP_BASE_URL` to the real internal app URL such as `https://warehouse-it.local`.
- Never commit `.env` or SMTP credentials.

## Backup And Restore

The app stores important local data in three places that should be backed up together:

- `prisma/dev.db`
- `uploads/assets`
- `uploads/facturas`
- `uploads/maps`

Use the backup script from the project folder:

```bash
npm run backup
```

The script creates a timestamped folder:

```text
backups/manual-YYYYMMDD-HHMMSS/
```

Each backup includes:

- `prisma/dev.db`
- `uploads/assets` when the folder exists
- `uploads/stock` when the folder exists
- `uploads/facturas` when the folder exists
- `uploads/maps` when the folder exists
- `backup-manifest.json`

The manifest records the backup timestamp, app/package version, optional git commit hash, database size, upload file counts, warnings, copied paths, and success status. Missing upload folders do not fail the backup; they are recorded as warnings. A missing or empty `prisma/dev.db` fails the backup with a clear error.

BitLocker vault backups:

- Recovery keys are stored encrypted in `prisma/dev.db` when `BITLOCKER_VAULT_SECRET` is configured.
- Backups do not include the vault secret. Store `BITLOCKER_VAULT_SECRET` separately in the company-approved password manager.
- Restoring a database without the original vault secret means existing BitLocker recovery keys cannot be decrypted.
- Secret rotation is future work and is not automatic.

Optional configuration:

```bash
BACKUP_DIR=D:\WarehouseBackups npm run backup
```

If `BACKUP_DIR` is omitted, backups go to `backups`.

### Backup Page And API

Open `/backups` to review recent backup manifests, file counts, warnings, and backup paths. The page can create a local backup through:

```http
POST /api/backups
```

Backup history is available through:

```http
GET /api/backups
```

The UI backup action uses the same copy-only helper as `npm run backup`. It does not run migrations, imports, status changes, or data cleanup.

### Manual Restore

Restore is intentionally manual for now.

1. Stop the dev/production server.
2. If possible, back up the current broken state first.
3. Copy the backed-up `prisma/dev.db` back to `prisma/dev.db`.
4. Copy the backed-up `uploads/assets` back to `uploads/assets`.
5. Copy the backed-up `uploads/stock` back to `uploads/stock` if stock photos exist.
6. Copy the backed-up `uploads/facturas` back to `uploads/facturas`.
7. Copy the backed-up `uploads/maps` back to `uploads/maps` if map images exist.
8. Run `npm install` if dependencies are missing on the restored machine.
9. Run `npx prisma generate` if Prisma client files are missing or the project was copied to a new machine.
10. Restore the matching `BITLOCKER_VAULT_SECRET` into `.env` if BitLocker vault records exist.
11. Start the app with `npm run dev` or the production start command.
12. Open `/api/health`.
13. Open `/dashboard`, `/devices`, and `/scan`.
14. Verify dashboard, inventory assets, stock photos, facturas, imports, alerts, jobs, and recent activity.
15. Open at least one asset photo, stock photo if available, one factura attachment if available, and one BitLocker vault summary if vault records exist.

Restore database and upload folders together whenever possible. Restoring the database without matching uploads can break asset photo, stock photo, or factura file links. Restoring uploads without the matching database can leave orphan files.

Restore drill recommendation:

1. Create or choose a fresh backup.
2. Copy the project to a temporary folder such as `C:\Dev\warehouse-it-inventory-restore-test`.
3. Restore `prisma/dev.db`, `uploads/assets`, `uploads/stock`, `uploads/facturas`, and `uploads/maps` from the same backup into that temporary folder.
4. Run `npm install`, `npx prisma generate`, `npm run doctor`, and `npm run build`.
5. Start the app on a temporary port and check `/api/health` and login redirect behavior.
6. Delete the temporary restore folder only after the drill results are recorded.

### OneDrive Warning

The active beta project path is:

```text
C:\Dev\warehouse-it-inventory
```

The old OneDrive copy at `C:\Users\abastida\OneDrive - TechStyle\Documents\New project 3` is legacy/reference only. Do not develop or deploy from it.

OneDrive can lock `.next`, SQLite, and Prisma files while syncing. That has already caused local build/database friction. Keep OneDrive for backup copies or exported files if useful, but the recommended active project path for daily use is:

```text
C:\Dev\warehouse-it-inventory
```

Do not move the project automatically from inside the app. Move it manually when you are ready, then verify backups, builds, uploads, and scheduled jobs from the new folder.

## Photo Compliance and Storage

Asset and stock photos are stored as files on disk. SQLite stores metadata such as file path, original filename, stored filename, MIME type, caption, photo type, size, dimensions when available, thumbnail path when available, uploader name/user id, source, and primary-photo flag for assets.

Open an asset detail page and use the `Photos` section to upload from a phone. The upload input uses:

```html
accept="image/*"
capture="environment"
```

That lets a phone open the rear camera for quick warehouse documentation.

Supported asset photo types:

- JPG/JPEG
- PNG
- WEBP
- HEIC/HEIF where the phone/browser provides a supported file

Photo categories:

- Main photo
- Overview
- Asset tag
- Serial label
- MAC/IP label
- Condition
- Damage
- Accessories
- Location / installed
- Factura evidence
- RMA condition
- Return condition
- Other

Asset detail pages show a photo checklist. For normal serialized assets the recommended set is overview, asset tag, serial label, and condition. Fixed/static assets also ask for a location/installed photo. Damaged, RMA, or returned assets may show additional damage, RMA condition, or return condition checklist items. The checklist is advisory in this phase and does not block assignments, loans, RMA, or stock workflows.

Photos are stored in:

```text
uploads/assets
uploads/assets/thumbs
uploads/stock
uploads/stock/thumbs
```

New photo uploads try to create a 400px thumbnail for list/card views. Asset and stock photo panels use thumbnails when available and open the full image only when tapped. Existing old photos are not batch-compressed or reprocessed automatically; they may appear in Data Quality or `/photos/compliance` as missing thumbnails until handled with the safe backfill tools.

Thumbnail backfill is a maintenance task, not an import. Always dry-run first:

```bash
npm run photos:backfill-thumbnails:dry-run
```

The dry-run reports missing thumbnail metadata, missing thumbnail files, missing original files, oversized photos, unsupported files, candidate counts, and estimated output thumbnails. It does not write files or update the database.

After reviewing the dry-run and creating a backup, run a limited confirmed apply:

```bash
npm run backup
npm run photos:backfill-thumbnails:apply -- --confirm --limit 100
```

You can also confirm with:

```powershell
$env:CONFIRM_PHOTO_BACKFILL="true"; npm run photos:backfill-thumbnails:apply
```

The apply command creates missing thumbnails and updates thumbnail metadata only. It does not delete photos, rewrite originals, compress originals, change captions/photo types, or modify asset/stock/factura records. Missing originals and unsupported files are skipped and reported for manual review.

If Prisma migration tooling reports drift on this real/imported SQLite database, do not reset the database. Back up first, inspect the drift, and prefer additive SQL or a controlled migration plan. Destructive resets are for disposable development databases only.

The `/photos/compliance` page is the phone-first photo queue. It shows assets missing recommended photo types, current photo counts, storage size signals, missing thumbnails, and quick actions to add a photo, open the asset, create a task, or generate a label.

Photo API routes:

- `GET /api/devices/:id/photos`
- `POST /api/devices/:id/photos`
- `PATCH /api/devices/:id/photos/:photoId`
- `DELETE /api/devices/:id/photos/:photoId`
- `POST /api/devices/:id/photos/:photoId/primary`
- `GET /api/stock/:id/photos`
- `POST /api/stock/:id/photos`

The app validates file type and max size, generates a safe unique filename, and never trusts the original filename for storage.

Photo deletion currently removes the asset photo record, full file, and thumbnail file when present. Until soft-delete/restore is implemented, treat delete as permanent and keep backups of `prisma/dev.db`, `uploads/assets`, `uploads/stock`, and `uploads/facturas`.

## Factura / Purchase Tracking

Facturas track purchase records for assets and stock items. One factura can link to many assets and many stock items. Stock movements can also reference a factura when stock is added, adjusted, or received.

Factura fields include:

- Factura number
- Vendor
- Vendor RFC
- Purchase date
- Received date
- PO number
- Total amount
- Currency
- Warranty start/end
- Notes
- Attached file metadata
- Optional CFDI XML metadata

Factura files and optional CFDI XML files are stored on disk, not in SQLite:

```text
uploads/facturas
```

Supported factura file types:

- PDF
- JPG/JPEG
- PNG
- WEBP
- XML (`.xml`, `text/xml`, or `application/xml`)

Workflow:

1. Open `/facturas/new`.
2. Enter the factura number, vendor, dates, amount, and warranty info.
3. Attach a PDF/photo of the factura and, when available, attach the matching CFDI XML.
4. Select assets and stock items to link.
5. Save.

Asset detail pages show linked factura information. Stock detail pages show linked factura information. Factura detail pages show linked assets, linked stock items, linked stock movements, and structured line items when entered.

Factura line item workflow:

1. Open `/facturas/[id]`.
2. Choose `Add Line Item` for manual entry, or choose `Extract` to review assisted candidates.
3. PDF text extraction uses local `pdftotext` for selectable-text PDFs only. It is intended for text PDFs, not scanned/image-only PDFs.
4. XML extraction parses local CFDI XML and can prefill exact Concepto candidates, including description, quantity, unit cost, importe, SKU/noIdentificacion, UUID, folio, vendor/RFC, date, currency, subtotal, and total.
5. Review source, confidence, warnings, detected totals, quantity, unit cost, and currency for every candidate, then explicitly choose `Create selected line items`.
6. Open `Link` on the line item and link up to the purchased quantity of matching assets.
7. Choose `Apply Value` only after reviewing the linked assets. Existing asset values are skipped by default unless overwrite is explicitly selected.
8. Review `/data-quality` for factura XML with no line items, line items with unlinked quantity, XML total mismatches, or linked assets missing values.

Line item safety rules:

- Line items do not run OCR, do not fetch remote XML entities, and do not parse scanned/image-only invoices.
- A PDF with selectable text is a `TEXT_PDF`. A PDF with no extracted text is treated as a scanned/image-only PDF and should use manual entry for now. Mixed PDFs should be reviewed manually because only the selectable text layer is parsed.
- PDF/XML extraction never creates line items automatically; every candidate requires explicit review and confirmation.
- If a factura already has line items, exact duplicate extraction candidates are blocked unless the user explicitly enables duplicate confirmation after review.
- XML upload rejects unsafe/non-XML files and XML extraction rejects external entity or stylesheet declarations.
- A line item cannot link more assets than its quantity.
- Existing asset values are preserved unless overwrite is explicitly selected.
- Applying a line item changes only the asset value profile and writes activity logs; it does not change asset tag, serial, status, assignments, loans, RMA, photos, stock, or factura file data.
- Asset Value CSV includes source factura and line item fields when values were applied from a line item.

CSV exports include:

- Device factura number, vendor, purchase date, cost, currency, warranty expiration, and photo count.
- Stock item factura number, vendor, and purchase date.
- Stock movement factura number and vendor.
- Full `facturas` export.
- Data Quality `factura-line-item-review` export, including XML-present, UUID/folio, extraction-review, and XML total mismatch fields when available.

## Backup Warning

SQLite backup alone is no longer enough.

Back up all of these together:

```text
prisma/dev.db
uploads/assets
uploads/facturas
```

If you restore only `prisma/dev.db` without the upload folders, photo and factura metadata will remain in the app but the files will be missing.

## Phase 1 Inventory And Assignments

The app has been reframed as `Warehouse IT Inventory`. Existing IPAM routes remain intact, but the UI now treats devices as inventory assets.

Phase 1 includes:

- Expanded asset fields: asset tag, optional IP/MAC/VLAN, condition, area/department, assigned employee, purchase date, warranty expiration, repair notes.
- Employees module with list, create, detail, and edit pages.
- Long-term assignments module with list, create, and detail pages.
- Phone-friendly assignment workflow: select employee, select one or more assets, accept terms, capture signature, submit.
- Assignment submit updates selected assets to `In Use / Assigned` and links them to the employee.

Not included yet by design:

- Loans/checkouts.
- Return workflows.
- SMTP email receipts.

Those are planned for later phases after this phase passes tests, lint, and build.

## Scanner Limitations

There are two scanner features:

- Camera scan at `/scan`, which uses the phone camera for QR/barcode labels.
- Network scan at `/scanner`, which runs server-side ping/ARP checks.

Camera scan requires a secure browser context. It works on `localhost` for desktop development; for phones on an internal server, serve the app over HTTPS using an internal certificate or trusted reverse proxy. Mobile browsers usually block camera access on plain `http://server-ip`.

The live scanner is designed for warehouse scanning: open `/scan`, start the camera, scan a QR/barcode/Data Matrix-style code that ZXing can read, and keep scanning labels without reloading the page. Manual entry and keyboard-wedge scanners still use the same lookup path.

If the live camera scanner does not open:

- Make sure the phone URL is HTTPS, not plain HTTP.
- Check the browser/site camera permission and allow camera access.
- Use the `/scan` page's `Scan from photo` fallback to capture or upload a label photo.
- Use the manual field for Bluetooth/USB keyboard-wedge scanners.
- If lookup fails with a server unavailable message, check Wi-Fi, VPN, firewall, and that the Next.js server is running.

Asset photo capture on asset detail uses the same phone-first camera expectations. Evidence photos are resized client-side before upload when possible, but the server still validates file type and size. Factura PDFs are not compressed by the photo capture flow.

The scanner runs on the server because browser JavaScript cannot reliably ping LAN devices. It uses OS `ping`, then attempts ARP and reverse DNS where available.

Expected limitations:

- Some devices block ICMP/ping.
- ARP visibility depends on the server network segment and OS permissions.
- Scans are capped by `maxScanSize` in Settings to avoid accidental large sweeps.
- Non-responsive inventory devices are not automatically marked offline.

## Map-Based Location Context

The `/map` page shows stored manual asset location context and warehouse location anchors. It does not perform GPS, triangulation, exact indoor positioning, printer polling, or UniFi API work.

### Configure The Warehouse Map

The app includes a sample map at:

```text
public/warehouse-map.svg
```

To use your own floor map:

1. Export a warehouse floor image as `.png`, `.jpg`, `.webp`, or `.svg`.
2. Put it in the `public` folder, for example `public/main-warehouse-map.png`.
3. Open `/map`.
4. Use the map configuration form.
5. Set the image URL to `/main-warehouse-map.png`.

The map image is displayed as a background. Location anchors and asset pins use percentage coordinates, where:

- `x = 0` is the left edge.
- `x = 100` is the right edge.
- `y = 0` is the top edge.
- `y = 100` is the bottom edge.

### Configure Location Anchors

Open `/map/ap-locations/new` and create warehouse location anchors when useful. These records are kept compatible with older AP marker data, but legacy AP sync is disabled by default.

Required fields:

- Anchor/AP name
- Anchor/AP MAC address when available
- Location label
- X coordinate
- Y coordinate

Optional fields:

- Legacy AP sync device ID
- Floor name
- Notes
- Map assignment

### Legacy Disabled AP Sync Input

The old local sync endpoint remains for compatibility but is disabled unless `LEGACY_UNIFI_SYNC_ENABLED=true` is explicitly set:

```http
POST /api/unifi/location-sync
```

Example payload:

```json
{
  "minimumHistoryMinutes": 30,
  "clients": [
    {
      "mac": "84:24:8D:10:20:30",
      "ip": "192.168.130.30",
      "hostname": "SCAN-CART-01",
      "apName": "U6-Pro-Shipping",
      "apMac": "AA:BB:CC:00:00:03",
      "apId": "unifi-ap-shipping",
      "online": true,
      "signalStrength": -66,
      "lastSeenAt": "2026-04-30T18:00:00.000Z"
    }
  ]
}
```

Legacy asset matching order:

1. MAC address
2. IP address
3. Device name/hostname

History rows are created only when:

- The asset has no prior location.
- The associated AP changed.
- Enough time passed since the last location row.
- The device was offline and is seen again.

This avoids duplicate history spam from repeated syncs on the same AP.

### Last Seen And Last 5 Locations

On a device detail page, the `Location / Last Seen` section shows:

- Last seen date/time
- Stored inventory/manual location
- Mapped location label if history exists
- `View on Map`
- `View Last 5 Locations`

The `/map?asset=<assetId>&history=5` view displays the last five stored location updates when available.

### Missing Assets

Set a device status to `Missing` from the device edit page. Then open `/missing`.

Missing assets show:

- Assigned user/department
- Current status
- Last seen
- Stored inventory/manual location context
- View on Map
- Show Last 5 Locations

### Location Limitations

- Location data is approximate and depends on manual updates or legacy local sync data if explicitly enabled.
- Stored location history can be stale.
- Wired/static devices may have no automatic location history.
- Do not treat location context as exact physical proof.

## Internal Deployment Notes

The recommended phone-friendly setup is:

1. Run the Next.js app on a Windows PC/server or internal Linux server.
2. Keep Next.js local on `localhost:3000`.
3. Put Caddy or Nginx in front of it for HTTPS.
4. Give the server an internal DNS name such as `ipam.warehouse.local`.
5. Open firewall access to HTTPS port `443`.
6. Trust the internal certificate authority on phones.

### Windows PC/Server With Node.js

Install Node.js, copy the project to the server, create `.env`, then run:

```bash
npm install
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run build
npm start
```

If Prisma migration is blocked on the Windows machine, use the included SQLite fallback after `npm run prisma:generate`:

```bash
node prisma/migrate-local.mjs
```

Keep regular backups of `prisma/dev.db`, `uploads/assets`, and `uploads/facturas`.

### Reverse Proxy Option: Caddy

Caddy is the easiest internal HTTPS option. Example config is in:

```text
deploy/caddy/Caddyfile.example
```

Basic Caddy shape:

```caddyfile
ipam.warehouse.local {
  tls internal
  reverse_proxy 127.0.0.1:3000
}
```

`tls internal` uses Caddy's internal CA. Install/trust Caddy's root certificate on warehouse phones, or phones will show certificate warnings and may block camera access.

### Reverse Proxy Option: Nginx

Nginx works well if you already use it internally. Example config is in:

```text
deploy/nginx/warehouse-ipam.conf.example
```

The important pieces are:

- Listen on `443 ssl`.
- Use a cert trusted by warehouse phones.
- Proxy to `http://127.0.0.1:3000`.
- Set `X-Forwarded-Proto https`.

### Certificate Options

Use one of these approaches:

- Internal enterprise CA: best option if your company already has trusted device certificates.
- Caddy `tls internal`: easy to run, but phones must trust Caddy's root CA.
- `mkcert`: good for small internal deployments. Run `mkcert -install`, generate a cert for your internal DNS name, configure Caddy/Nginx to use it, then install the mkcert root CA on phones that need access.
- Self-signed cert: works only after each phone trusts the certificate or its root CA. Without trust, users will see warnings and camera access can fail.

Example `mkcert` flow:

```bash
mkcert -install
mkcert ipam.warehouse.local 192.168.10.25
```

Use the generated `.pem` and `-key.pem` files in the Caddy or Nginx examples. Replace `192.168.10.25` with the server's LAN IP.

### Phone Access Steps

1. Connect the phone to the warehouse Wi-Fi/VLAN that can reach the IPAM server.
2. Open `https://ipam.warehouse.local`.
3. If prompted, allow camera access.
4. Go to `/scan`.
5. Tap `Start camera scan`.
6. If live video is blocked, use `Scan from photo` or the manual field.

Avoid `http://server-ip:3000` for phone use. It is useful for server testing, but it is not a camera-friendly production URL.

### Firewall Rules

When using a reverse proxy, open only:

- TCP `443` inbound for HTTPS.
- TCP `80` inbound only if your proxy redirects HTTP to HTTPS.

Do not expose port `3000` to the whole LAN unless you intentionally want direct HTTP access for testing.

Windows Firewall example:

```powershell
New-NetFirewallRule -DisplayName "Warehouse IPAM HTTPS" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 443 -Profile Private,Domain
New-NetFirewallRule -DisplayName "Warehouse IPAM HTTP Redirect" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 80 -Profile Private,Domain
```

A ready-to-run example is also in:

```text
deploy/windows/allow-warehouse-ipam-firewall.ps1
```

### Troubleshooting Phone Access

Camera permission denied:

- Confirm the URL starts with `https://`.
- In the phone browser site settings, reset or allow camera permission for the IPAM site.
- Close and reopen the browser tab after changing permission.
- Try `/scan` again, or use `Scan from photo`.

Browser says the site is not secure:

- The phone does not trust the certificate.
- Install the internal CA, Caddy local CA, or mkcert root CA on the phone.
- Prefer an internal DNS name over a raw IP when generating the certificate.

Phone cannot reach the server:

- Verify the phone is on the correct warehouse Wi-Fi/VLAN.
- Confirm the server LAN IP is reachable from that VLAN.
- Check Windows Firewall or host firewall rules for port `443`.
- Confirm Caddy/Nginx is running and listening on `443`.
- Test from another PC on the same network with `https://ipam.warehouse.local`.

HTTPS certificate warnings:

- Make sure the certificate includes the exact DNS name phones use.
- If phones use an IP address, the certificate must include that IP as a subject alternative name.
- Install the root CA, not just the leaf/server certificate, when using local CA tools.

Scanner opens but no video:

- Check browser camera permission for the site.
- Make sure no other app is using the camera.
- Try Chrome/Safari directly instead of an embedded browser.
- Use the `Scan from photo` fallback to confirm barcode decoding works.
- If the page is plain HTTP, live camera access will usually remain blocked.

For shared production use, also consider scheduled SQLite backups, server monitoring, and eventually authentication/role controls.

## Reports Lite

Use `/reports` for phone-first operational summaries without turning the app into a full reports module. The hub links to focused report pages for:

- Inventory
- Assignments
- Loans
- Stockroom
- Network / IPAM
- Photo compliance
- Audits
- RMA
- Warranty / Facturas
- Maintenance
- Asset values
- Tasks / IT work

Each report page shows summary cards and bounded recent or priority rows. CSV exports are available from `/api/reports/[type]/export`, for example `/api/reports/inventory/export`, `/api/reports/stock/export`, or `/api/reports/asset-values/export`.

Reports require sign-in and respect existing role permissions. Audit reports use `audits.read`, task reports use `tasks.read`, and other operational summaries use `inventory.read`. Reports Lite intentionally does not include charting, scheduled emailed reports, full analytics, sensitive notes, credentials, BitLocker data, or invoice OCR.

## Phase 89 Full Interface Polish Mega-Pass

Phase 89 was the final broad UI polish pass before Team Beta usage. The pass stayed UI-only and did not add new workflows, models, offline action types, service worker caching, OCR, SNMP, UniFi, Zebra printing, SMTP behavior, BitLocker behavior, auth/session changes, or database resets.

What changed:

- The application shell now uses a bounded application shell so wide desktop screens do not stretch operational pages into awkward full-width layouts.
- Shared UI helpers were expanded with `PolishedCard`, `ActionGrid`, and `KeyValueGrid` for consistent phone-first card headers, action wrapping, and readable metadata blocks.
- The UI Preview Lab includes Phase 89 shell polish samples for 48px tap targets, stacked mobile actions, safe key/value summaries, and non-sensitive visual QA content.
- Navigation user labels use plain ASCII separators for cleaner rendering across browsers and devices.
- Tests cover the final polish guardrails so future changes keep the app bounded, reusable, and phone-first.

Phase 89 intentionally kept daily workflow behavior stable. Any future visual work should reuse these shared helpers first, avoid raw wide tables on phones, and keep sensitive values out of screenshots, labels, docs, logs, and previews.

### Hotfix Phase 89B Mobile Sidebar Drawer

Mobile navigation now uses an off-canvas drawer instead of a bottom sheet or visible sidebar. On narrow screens, the drawer is hidden by default, opens from the mobile header or bottom `Menu` button, shows a backdrop, closes on backdrop tap, closes on Escape, and closes after tapping a nav link. Desktop keeps the normal visible sidebar and the same route/permission logic.

Beta QA should check 320px, 360px, 390px, and 430px widths for no horizontal overflow, readable nav labels, scrollable drawer content, and content using the full width when the drawer is closed.

## Phase 90A Scan, Camera, Mobile Action, and Field-Flow Blocker Fixes

Phase 90A addresses critical usability and technical blockers identified during controlled beta field testing of the app.

What changed:
- **Immediate Scan Stop & Close**: The camera scanner component (`camera-scanner.tsx`) now freezes the frame and stops the video stream/media tracks immediately upon successful detection of a barcode or QR code. This turns off the physical phone camera light instantly and prevents duplicate scan events. The quick scan panel now closes the scanner overlay on detection to show the review card immediately.
- **Top-Right Header Scan Button**: Fixed the header Scan button to route correctly to `/scan` on both mobile and desktop. It is keyboard accessible, has an explicit tag, and is not blocked by z-index or navigation drawer states.
- **Photo Checklist Camera Binding**: Fixed the black camera preview issue by replacing a race-prone `setTimeout` with a React callback ref (`videoRef`) to bind the media stream as soon as the video element mounts. Implemented a fallback to any available camera if the ideal environmental/rear camera constraint fails.
- **Mobile Actions Menu Redesign**: Replaced the giant fixed-bottom mobile action panel on device details with a clean, in-page **Asset Actions** card. Primary actions (Scan label, Move / Relocate) are directly visible, secondary actions are grouped under an expandable **More Actions** drawer, and the decommission action is isolated in a separated **Danger Zone**.
- **UI Preview Lab Updates**: Added static mock-up examples to `/admin/ui-preview` for scan results review, camera fallback error warnings, manual scan inputs, collapsible actions menus, and phone-first scan workflows.
- **Test Suite Alignment**: Adjusted unit tests in `tests/phase42-pwa-camera.test.ts` to expect immediate stop and track release. All tests pass successfully.

## Phase 90B Admin Center, Master Data, Controlled Lists, IP Ranges, and Settings Rework

Phase 90B introduces the Admin Center and Master Data taxonomies foundation to prevent dirty data from inconsistent free-text inputs, and simplifies settings overview flows.

What changed:
- **Admin Center Dashboard**: Created `/admin` which acts as the central admin-only dashboard (`hasPageRole("ADMIN")`), organizing Users, Master Data, Network/IP, Email, and Default settings in a clean phone-first card layout.
- **Master Data Taxonomy**: Added the `ControlledValue` model and implemented the `/admin/master-data` UI with automatic idempotent seeding of defaults (Asset Categories, Areas/Departments, Task Categories, Stock Categories, Printer Consumables) on first visit. Enforces case-insensitive duplicate checks and blocks deletion of values in use by active devices, tasks, or stock items.
- **Settings Page Rework**: Redesigned `/settings` to act as a system status and diagnostic overview (displaying session, SMTP, and database stats) with clear redirection to the Admin Center.
- **Network / IP Range Management**: Reworked IP range management under `/admin/ip-ranges` with strict overlap validations on create/update and checks to prevent hard deleting subnets that have devices assigned.
- **Email & Notifications Section**: Implemented `/admin/email-notifications` to verify SMTP connectivity parameters cleanly (hiding secrets) and configure automated notification rules. Added an admin-only POST endpoint at `/api/admin/test-email` to send transport validation test emails.
- **Defaults & Explanations**: Created inventory and stock/maintenance defaults documentation pages. Refactored `/zones` to clearly explain maps, physical AP anchors, expected zones, and auto-resolving movement alerts.
- **Resource Flag**: Added a `requiresCredentials` boolean flag to the `ToolLink` resource model, updating form views, tool cards list, and schemas.
- **UI Preview Lab Updates**: Added static mock-ups to `/admin/ui-preview` for Master Data rows, IP range cards with overlaps, email settings, default values, and zone explanations.
- **Unit and Integration Tests**: Added a comprehensive test suite `tests/admin-center.test.ts` to test duplicate master data blocking, used-value deletions, range overlaps, and resource flags.

## Phase 90C: Inventory Intake, Bulk Asset Intake, Flash Pairing, and Sled/iPod/iPhone Mapping Rework

Phase 90C improves the inventory intake workflows, adds a new Pair Companion Devices flow, provides default charger tracking for laptops, introduces Mode B mapping csv/tsv import/paste for bulk receive, and updates the Data Quality check routines.

What changed:
- **Intake Hub 7-card layout**: Replaced the previous 4-card intake layout on `/intake` with a 7-card layout containing: Add One Asset, Bulk Receive Serialized Assets, Pair Companion Devices, Inventory Count / Audit, Photo Follow-Up, Print Labels, and Import History. Added a "What's the difference?" section.
- **Smart Asset Tag Suggestion**: Automatically suggests next sequential asset tags based on category prefix (e.g. `GHT-LP-001` for LAPTOP, `GHT-SLD-001` for SCANNER, `GHT-IPO-001` for PHONE) using a `/api/devices/suggest-tag` API endpoint.
- **Laptop Charger Tracking**: Added a nullable `chargerIncluded` Boolean to `Device` model. Laptops default to "Has charger" checked during intake, which can be deselected.
- **Bulk Receive Mode B Mapping**: Added a Mode A/B tab selection to bulk intake. Mode B allows copy-pasting CSV/TSV data matching serials to asset tags and companion devices, validates client-side, and shows validation badges (Ready, Duplicate, ExistingAsset, ExistingSerial, PairedMissing, Needs Review).
- **Pair Companion Devices / Flash Pairing**: Added `/intake/pair` to allow quick scanner/manual pairing of existing companion devices (sleds with iPods/iPhones). Warns users if either device is already paired and allows one-click override.
- **Data Quality Enhancements**: Added checks for serialized categories missing serial numbers (LAPTOP, SCANNER, PHONE), laptops missing charger status (`chargerIncluded` is null), and active device relationships with status `NEEDS_REVIEW`.
- **UI Preview Lab Updates**: Added static mock-ups to `/admin/ui-preview` for Phase 90C companion pairing, tag suggestions, charger status checkbox, and bulk intake mapping formats.
- **Unit and Integration Tests**: Added comprehensive test suites in `tests/intake.test.ts` and `tests/device-pairing.test.ts` verifying tag suggestions, CSV parsers, mapping validation, pairing conflicts, and database migrations. All 464 tests pass.

## Phase 90D: Stock Movement, Restock, Physical Count, Barcode/QR Codes, and Label Generator Rework

Phase 90D separates stock creation from restocking, introduces the guided label generator workflow, implements precise range padding generators, supports stock shelf labels, and cleanses the printable label view.

What changed:
- **Stockroom 4-Action Dashboard**: Updated `/stock` to feature four prominent operational action cards: Add New Stock Type, Restock Inventory, Issue / Loan Item, and Physical Count.
- **Restock Workflow**: Created `/stock/restock` to manage restocks independently from stock creation. Provides live previews showing current vs. target stock quantities. Restocks require linking to a purchase factura and are saved with the `RESTOCK` movement type.
- **Physical Count & Stock Audit**: Created `/stock/count` to run physical audits. Calculates deltas automatically and warns the user with prominent red alerts when registered stock is reduced. Requires choosing an adjustment reason (`DAMAGED` or `LOST`) when lowering stock.
- **Label Generator Workflow Hub**: Redesigned `/labels` into a guided workflow hub offering 6 print options: Existing Assets, Stock Items, Range / Pattern, Batch Sheet, Manual List, and Alias-linked Labels.
- **Sequential Range Generator with Custom Padding**: Updated the range generator to strictly respect padding choices. Previews sequential ranges (e.g. J01, J001, STK-0001) with live count indicators.
- **Stock Shelf Label Support**: Added support for printing stock labels (e.g., STK-XXXX) mapped directly to shelf barcodes.
- **Clean Print CSS Viewports**: Appended `@media print` styling rules in `app/globals.css` to hide header navigation sidebar layouts, borders, and margins, ensuring clean label sheets.
- **UI Preview Lab Updates**: Appended static previews for the Restock flow, Physical Count Delta alerts, and guided workflow cards to the UI Preview Lab.
- **Unit Tests**: Created `tests/stock-movements-labels.test.ts` to verify stock calculations, range padding generators, and API route structures. All 473 tests pass successfully.

## Phase 90E: Assignments, Asset Loans, RMA, Badge Scan, Asset Scan, Email Rules, and Transfer Warning Rework

Phase 90E transforms the Assignments, Quick Loans, and RMA screens into scan-first, mobile-friendly, safe, and operationally realistic workflows for beta field testing.

What changed:
- **Scan-First & Mobile-Friendly Assignment Form**: Redesigned `/assignments/new` to be scan-first and phone-friendly. Removed the giant scrollable list of all available assets. Users scan or type asset tags / serial numbers to add them to a compact, persistent list of selected items. Includes checkbox toggles for "Laptop Charger Included" directly on laptop cards.
- **Employee Badge Scan & Lookup**: Added a Badge ID scan/manual lookup field to find active employees or temporary borrowers using the `/api/scan-lookup` endpoint. If a badge/name search is unsuccessful, authorized IT staff/admins are offered inline creation forms to add a new Employee or Temporary Borrower profile with explicit confirmation.
- **Already Assigned & Overwrite Transfer Warnings**: The `/api/assignments` endpoint now checks if selected assets are already assigned or loaned. If conflicts exist, the API returns a 422 warning, and the UI displays a clear conflict card showing who currently holds the asset. Requires explicit checkbox confirmation ("Confirm Transfer of Asset") to overwrite the assignment, which automatically returns the conflicting assignment or loan cleanly under a single database transaction.
- **Logged-in IT Tech Auto-fill**: Pre-populates the "Assigned by" field with the name of the currently logged-in user retrieved from the server session.
- **SMTP-Independent Email Rule Compilation**: Configured assignment email rules: receipt confirmation goes to the assignee, assignee manager, and `it.techstyle@g-global.com` (with fallback configured CCs). Configured asset loan email rules: checkout confirmation goes to the OPS mailbox (`process.env.OPS_MAILBOX` or `ops@g-global.com`), borrower manager, and `it.techstyle@g-global.com`. Creation of assignments or loans is SMTP-independent; if SMTP is not configured, the app logs a skipped email status and continues without crashing, presenting a clear warning banner to the user.
- **RMA Draft & Optional Metadata**: Allowed saving draft RMAs with empty metadata fields (carrier, tracking, destination, vendor, contact) without failing database schema constraints.
- **RMA Category Filter Fix**: Corrected the category filter in `/components/rma-form.tsx` to strictly match the selected category enums or labels, resolving the bug where choosing "Phones" would display "Access Points".
- **RMA Scan-First Device Selection & Damage Notes**: Replaced checkbox-grid selectors with a scan-first device selector, allowing bulk scanners to add devices to the active RMA case. Each selected RMA device includes a damage note input and a photo status checkbox ("Photo Attached").
- **RMA Export Columns Enhancement**: Updated the `rma-items` export endpoint (`app/api/export/[type]/route.ts`) to output: RMA number, RMA title, status, asset tag, serial number, category/type, brand, model, location/area, damage/issue note, photo attached/needed, destination, vendor, contact, carrier, tracking, sent date, and notes.
- **UI Preview Lab Updates**: Added static safe mocks at `/admin/ui-preview` for: Badge Scan & Lookup, Temporary Borrower creation, Overwrite Transfer confirmations, SMTP skipped warnings, Loan Selected list, RMA drafts, and RMA Export table columns.
- **Unit Tests**: Appended unit tests in `tests/assignments.test.ts` to test transfer validation rules, and in `tests/rma.test.ts` to test category filters and draft validation. All 476 tests pass successfully.

## Phase 90F: Maintenance Profiles, Facturas, Printer Records, and Reporting Cleanup

Phase 90F keeps the beta workflow stable while making maintenance, facturas, asset value, printer records, and operational exports safer.

What changed:

- Maintenance schedules now use status/context-aware profiles. Active printers use the monthly printer interval, active scales use the 3-month scale interval, stock/spare/storage assets use longer intervals, and retired/lost/missing/disposed assets are excluded from normal recurring maintenance alerts.
- Maintenance pages now explain why an asset is due, which profile applies, and why retired/decommissioned assets are excluded. Maintenance follow-up task links use the existing Maintenance task category and stay unassigned unless a tech takes them.
- Facturas now have a lifecycle status: Active, Archived, Void, or Invalid. Normal factura lists and link pickers show Active by default. Archived/voided/invalid records remain directly reviewable and can be shown intentionally.
- Factura hard delete is Admin-only and blocked when assets, stock items, stock movements, line items, extraction attempts, tasks, PO notes, PDF/XML files, or other history depend on the factura. Archive or void bad records instead of deleting linked history.
- Asset detail value cards now make the source clearer: manual/import/factura-line value, linked factura metadata, or a missing-factura empty state.
- Printer/MFP maintenance records now support manual page count/meter readings and consumable/part change notes using the existing maintenance record workflow. No SNMP, printer credentials, live page-count polling, or direct printer commands were added.
- Reports/Data Quality now include maintenance profile/exclusion signals, factura lifecycle counts, linked archived/voided factura review, printer page-count/consumable rows, and the `po-requisition-formato` CSV export columns.
- `/admin/ui-preview` includes static non-sensitive examples for maintenance profiles, factura lifecycle warnings, asset value source cards, printer records, PO FORMATO rows, and related Data Quality checks.

PO/Requisition FORMATO export columns:

- `CANT`
- `UM`
- `DESCRIPCION DEL MATERIAL`
- `MARCA Y/O MODELO`
- `AREA DE USO`
- `USO Y FUNCION DEL ARTICULO`
- `DURACION`
- `LINK O IMAGEN DE EJEMPLO`
- `FECHA EN QUE LO NECESITA EN ALMACEN`
- `SUGERENCIA DE PROVEEDOR`
- `NOTAS`

Intentionally not implemented in Phase 90F: OCR expansion, SNMP/live printer polling, direct Zebra sending, SMTP credentials, BitLocker reveal changes, external purchasing-app integration, broad reports module rebuild, and hard-deleting linked facturas.


