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

## Production V1 Sign-Off / Beta Freeze

Phase 78 verdict:

- Controlled Team Beta is ready for Axel plus one trusted IT teammate.
- Production V1 codebase is ready pending external blockers.
- Wider rollout is not approved until external blockers are closed and the rollout checklist is complete.

External blockers:

- Real SMTP provider credentials and one real QA email send.
- Real physical phone certificate trust, camera scan, PWA/install, close/reopen offline move, close/reopen offline photo, and reconnect sync validation.
- `BITLOCKER_VAULT_SECRET` stored in the approved password manager before real recovery keys are entered.
- Optional `npm audit` and dependency review before broad production deployment.

Ready / validated capabilities:

- Core: auth/roles, inventory, scan/manual scan, intake, asset detail, assignments, loans, stockroom, maintenance, tasks, RMA, labels, maps/locations, reports, Data Quality, backups, restore drill, scheduled jobs, decommission, facturas, factura line items, PDF text extraction, XML extraction, asset value/depreciation, and BitLocker encrypted vault with fake QA validation.
- Offline: queue foundation, offline test note, offline serialized asset move, offline conflict review center, offline asset photo upload queue, storage safety warnings, missing browser-blob conflict behavior, and mobile-width QA at 320/360/390.
- Security/safety: no secrets in health/settings/docs/logs, no BitLocker plaintext in exports/logs/UI, server-side validation for offline sync, documented backup/restore, and verified role restrictions.

Not included in Production V1:

- Offline stock issue/return, offline stock photos, offline RMA, offline decommission, offline BitLocker, offline factura/import/admin actions, service worker caching, or a full offline inventory database.
- OCR for scanned PDFs beyond the current lightweight extraction work.
- SNMP printer/scale polling, UniFi API integration, direct Zebra printer sending, automatic emailed reports, or Docker runtime validation on this beta machine while Docker is unavailable.
- SMTP real send and full physical phone camera/PWA validation until the external blockers are completed.

Rollout checklist before adding more than Axel plus one teammate:

1. Save `BITLOCKER_VAULT_SECRET` in the approved password manager.
2. Complete real phone validation: phone model/browser, certificate trust, live camera scan, PWA/install if needed, offline move close/reopen, offline photo close/reopen, and reconnect sync.
3. Configure SMTP credentials locally without committing `.env`.
4. Send one real QA test email.
5. Confirm `/api/health` has no degraded SMTP warning.
6. Run `npm run backup` before first real team use.
7. Confirm `npm run jobs:run-due` succeeds.
8. Confirm the current beta URL and `APP_BASE_URL` match, preferably `https://warehouse-it.local`.

Daily beta checklist:

- Start of day: confirm app opens, check `/api/health`, `/data-quality`, `/offline`, `/offline/conflicts`, confirm jobs, and confirm latest backup exists.
- During use: sync offline actions before leaving the warehouse, do not clear browser storage with pending photos, review conflicts instead of ignoring them, and do not store real BitLocker keys unless the vault secret is safely stored.
- End of day: run `npm run backup`, check failed/conflicted offline syncs, and confirm QA/test records are not mixed with real production counts.

Emergency / disaster checklist:

1. Stop the app.
2. Do not delete the database or upload folders.
3. Copy the current database and upload folders to an emergency folder.
4. Identify the latest backup.
5. Restore only to a separate folder first.
6. Confirm `BITLOCKER_VAULT_SECRET` is available.
7. Run `npx prisma migrate status` and `npx prisma migrate deploy`.
8. Run `npm run doctor` and `npm run build`.
9. Test `/api/health` and login.
10. Only then repair or replace the live app.

Losing `BITLOCKER_VAULT_SECRET` means existing encrypted BitLocker keys cannot be decrypted.

Final smoke test matrix:

| Area | Status | Last validated phase | Notes / blocker |
| --- | --- | --- | --- |
| Login | Ready | Phase 76 | HTTPS redirect fixed for `https://warehouse-it.local`. |
| Dashboard | Ready | Phase 76 | Authenticated HTTPS page check passed. |
| Scan | Ready | Phase 76 | Server-side HTTPS check passed; real phone live camera still pending. |
| Inventory | Ready | Phase 78 | Existing tests/build pass; no broad data mutation. |
| Asset detail | Ready | Phase 76 | QA asset detail checked through HTTPS. |
| Photo upload | Ready | Phase 76 | QA offline photo original/thumbnail opened; real phone camera pending. |
| Offline queue | Ready | Phase 75 | Storage safety and mobile-width queue review complete. |
| Offline move | Ready | Phase 76 | QA move synced through HTTPS. |
| Offline photo | Ready | Phase 76 | QA photo synced through HTTPS. |
| Offline conflicts | Ready | Phase 76 | Missing blob conflict behavior validated. |
| Data Quality | Ready | Phase 76 | HTTPS page check passed. |
| Reports | Ready | Phase 55/78 | Server-side checks and tests pass; no full reports expansion in freeze. |
| Backup | Ready | Phase 78 | `npm run backup` validates database and uploads. |
| Restore | Ready | Phase 70 | Separate-folder restore drill passed. |
| Jobs | Ready | Phase 78 | `npm run jobs:run-due` succeeds; final pass may have no jobs due. |
| BitLocker fake QA reveal | Ready | Phase 70 | Restore drill confirmed Admin reveal with matching secret. |
| Factura line items | Ready | Phase 60 | Existing tests/build pass. |
| PDF/XML extraction | Ready | Phase 66/65 | Existing tests/build pass; OCR expansion is not V1. |
| Asset value | Ready | Phase 59/60 | Existing tests/build pass. |
| Decommission page load | Ready | Phase 69/78 | Included in build and readiness scope. |
| Settings health | Ready | Phase 77/78 | Sanitized SMTP status; no secrets exposed. |
| Email test missing-SMTP behavior | Ready with blocker | Phase 77 | Admin test logs skipped result until SMTP credentials exist. |
| HTTPS Caddy route | Ready server-side | Phase 76 | Physical phone trust still pending. |
| Physical phone validation | Pending | Phase 76 | Requires actual beta phone/browser. |

## Phase 79 Real Phone Validation Status

Phase 79 workstation-side HTTPS checks passed on June 18, 2026:

- Runtime path: `C:\Dev\warehouse-it-inventory`.
- Current beta URL / `APP_BASE_URL`: `https://warehouse-it.local`.
- Workstation LAN IP shown by Next runtime: `192.168.0.67`.
- Caddy process is running from `C:\Tools\caddy\caddy.exe`.
- App is running on port `3000`.
- `/api/health` is degraded only for missing SMTP credentials.
- `/login` opens through Caddy.
- Login redirects to `https://warehouse-it.local/dashboard`, not localhost or `127.0.0.1`.
- Authenticated workstation HTTPS checks passed for `/dashboard`, `/scan`, `/devices`, QA asset detail, `/offline`, `/offline/move`, `/offline/conflicts`, `/data-quality`, `/reports`, QA asset photo, and QA asset thumbnail.

Real phone validation is still pending and this blocker remains open until the actual beta phone is tested.

Record these fields during the real phone test:

- Phone model:
- OS version:
- Browser:
- Wi-Fi/network:
- URL tested:
- `warehouse-it.local` resolves on phone: yes/no
- Certificate trusted with no warning: yes/no
- Login opens and stays on `https://warehouse-it.local`: yes/no
- Dashboard opens after login: yes/no
- Camera permission prompt appears: yes/no
- Live rear-camera scan works with QA label: yes/no
- Manual asset-tag fallback works with `QA-PHONE-FIELD-001`: yes/no
- Scan-from-photo/file fallback works: yes/no
- Add to Home Screen / PWA install available: yes/no
- Installed shortcut opens and preserves session: yes/no
- Offline move close/reopen persists and syncs to `QA / Phone / Bench 79`: yes/no
- Offline photo close/reopen persists and syncs: yes/no
- Original photo opens after sync: yes/no
- Thumbnail opens after sync: yes/no
- Storage-loss safety tested on phone: yes/no/skipped
- Mobile UI issues observed:
- Remaining blocker:

If `warehouse-it.local` does not resolve on the phone, document whether a safe DNS/router/hosts solution exists. Use direct HTTP LAN IP only as a fallback and do not mark the trusted HTTPS/camera blocker closed.

If the certificate is not trusted, do not weaken security permanently. Document the browser warning and keep live camera/PWA validation blocked until trust is fixed.

## Phase 81 Session Persistence Notes

Expected beta login behavior:

- Use `https://warehouse-it.local` consistently for the whole session.
- Normal app login sessions last 12 hours.
- Refreshing Dashboard, Settings, Backups, Jobs, Admin, Offline, Inventory, Reports, and Data Quality should keep the user signed in while the session is valid.
- The session cookie is HTTP-only, `SameSite=Lax`, scoped to `/`, and marked `Secure` when `APP_BASE_URL` is HTTPS.
- Rolling session extension is intentionally not enabled in this phase. If a shift needs longer than 12 hours, record that as a future hardening requirement.

Troubleshooting:

- App login page after only a few minutes: confirm `APP_BASE_URL=https://warehouse-it.local`, confirm Caddy forwards host/proto headers, then clear cookies for `warehouse-it.local` and log in again.
- Browser-native username/password popup: treat it as proxy/browser auth trouble, not the app login.
- Redirect to `localhost` or `127.0.0.1`: fix `APP_BASE_URL` and Caddy forwarding before continuing phone tests.
- Switching between HTTPS hostname, LAN IP, and localhost creates separate browser origins. Cookies, camera permissions, PWA install state, and offline storage do not automatically transfer between them.
- If browser storage/cookies are cleared on the phone, offline queued photos/actions may be affected and should be checked before field work continues.

## Phase 80 Actual Beta Phone Field Run Status

Phase 80 workstation-side readiness checks passed on June 18, 2026, but the actual beta phone field run was not completed in this Codex session because no physical phone/browser results were available.

Final phone classification: **BLOCKED / NOT RUN ON PHONE**.

Workstation checks completed:

- App and Caddy were running.
- `https://warehouse-it.local/api/health` was degraded only for missing SMTP credentials.
- `/login` opened through Caddy.
- Login redirected to `https://warehouse-it.local/dashboard`, not localhost or `127.0.0.1`.
- Authenticated HTTPS checks returned 200 for `/dashboard`, `/scan`, `/devices`, QA asset detail, `/offline`, `/offline/move`, `/offline/conflicts`, `/data-quality`, `/reports`, QA asset photo, and QA asset thumbnail.

Actual phone result fields remain pending:

- Phone model / OS / browser:
- Wi-Fi/network:
- URL tested:
- HTTPS/cert trust result:
- Camera scan result:
- Manual fallback result:
- Scan-from-photo result:
- PWA result:
- Offline move close/reopen result:
- Offline photo close/reopen result:
- Storage-loss result:
- Mobile UI result:
- Final phone classification: PASS / PARTIAL / FAIL, only after a real phone test.

Next action: run the documented phone checklist with QA asset `QA-PHONE-FIELD-001`. If any result fails, document the exact browser error, certificate warning, camera behavior, offline persistence issue, or fallback used. Do not mark the real-phone blocker closed until the phone result fields are filled.

## Phase 82 Actual Phone Field Run Status

Phase 82 workstation-side checks passed on June 19, 2026, but the actual phone field run was **not completed** because no physical phone/browser results were provided in this Codex session.

Final phone classification: **BLOCKED / NOT RUN ON PHONE**.

Workstation checks completed:

- Runtime path: `C:\Dev\warehouse-it-inventory`.
- Current beta URL: `https://warehouse-it.local`.
- Caddy was running from `C:\Tools\caddy\caddy.exe`.
- App was restarted and listened on port `3000`.
- `https://warehouse-it.local/api/health` returned 200 and was degraded only for missing SMTP credentials.
- `/login` opened through Caddy.
- Unauthenticated `/dashboard` redirected to login.
- Temporary Admin login redirected to `https://warehouse-it.local/dashboard`, not localhost or `127.0.0.1`.
- Authenticated `/dashboard` returned 200.
- Temporary QA user/session/login activity was deleted after the workstation smoke check.

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
- Page navigation smoke:
- Camera scan result:
- Manual `QA-PHONE-FIELD-001` fallback:
- Scan-from-photo/file fallback:
- PWA / Add to Home Screen result:
- Offline move close/reopen/sync result for `QA / Phone / Bench 82`:
- Offline photo close/reopen/sync result:
- Storage-loss safety result:
- Mobile layout result:
- Final phone classification: PASS / PARTIAL / FAIL, only after a real phone test.

Next action: run the actual phone checklist with QA asset `QA-PHONE-FIELD-001`. Do not close the physical phone blocker until the phone DNS/cert/camera/PWA/offline persistence fields are filled with real phone/browser results. If HTTPS fails on the phone, document the exact DNS or certificate error and use HTTP LAN fallback only as a clearly labeled fallback.

## Phase 83 SMTP Real Credentials + First QA Email Status

Phase 83 workstation-side SMTP safety checks ran on June 19, 2026, but no approved real SMTP credentials were available in this Codex session.

SMTP final status: **BLOCKED / WAITING ON SMTP CREDENTIALS**.

Provider type: pending approved provider selection. Use only approved SMTP such as Google Workspace SMTP relay, Microsoft 365 SMTP, SendGrid, Mailgun, or an internal company SMTP relay. Do not use a personal account password unless explicitly approved.

QA recipient category: pending approved QA recipient. Do not email real employees or external recipients until the recipient is intentional and approved.

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

## Phase 84 Final Production V1 Go / No-Go

Phase 84 final workstation-side sign-off ran on June 19, 2026.

Final verdict:

- Controlled Team Beta: **GO** for Axel plus one trusted IT teammate.
- Production V1 Codebase: **READY pending external/manual blockers**.
- Wider Rollout: **NO-GO** until the external blockers are closed and reviewed.

### Final Go / No-Go Matrix

| Area | Status | Evidence / Next Action |
| --- | --- | --- |
| Codebase | READY | Use the release gate: backup, migrations, Prisma generate, doctor, tests, lint, build, jobs, and runtime smoke. |
| Controlled beta | GO | Limited to Axel plus one trusted IT teammate following the daily beta checklist. |
| Wider rollout | NO-GO | Do not add more users until phone, SMTP, BitLocker secret storage, and dependency review decisions are closed. |
| Phone validation | BLOCKED | Real physical phone DNS, trusted certificate, camera, PWA, close/reopen offline move, close/reopen offline photo, and sync results remain required. |
| SMTP | BLOCKED | Configure approved SMTP credentials in local `.env` and send exactly one approved QA email. |
| BitLocker secret storage | MANUAL REQUIRED | Store `BITLOCKER_VAULT_SECRET` in an approved password manager. Losing `BITLOCKER_VAULT_SECRET` means existing encrypted BitLocker keys cannot be decrypted. |
| Backup/restore | GO | Backup/restore runbook and Phase 70 restore drill evidence are available. |
| Offline move/photo | GO for controlled beta | Offline serialized move and offline asset photo queue are allowed with current conflict and browser-storage limitations. |
| Sessions/auth | GO | Rolling session expiry, 12-hour cookie/session behavior, and public logout redirect are documented and tested. |
| Caddy HTTPS workstation route | GO | Use `https://warehouse-it.local` as the single beta URL; avoid mixing hostname, LAN IP, and localhost. |
| Data Quality/reports | GO | Review/export surfaces are available for controlled beta cleanup and audit follow-up. |
| Git/secret safety | GO | Confirm no secrets/runtime data are tracked by Git before commit/push. |

## Phase 87 Performance Notes

Phase 87 ran a production-build slow page/API audit on the controlled beta data.

Performance fixes now in place:

- `/api/devices` is bounded and paginated. Default page size is 50, `limit` is capped at 100, and responses include pagination metadata.
- `/api/data-quality` is summary-first by default. It returns compact totals/health data for fast checks.
- Use `/api/data-quality?detail=preview` only when a capped review preview is needed.
- Use `/api/data-quality?detail=full` only for intentional debugging. Do not use it as a polling or dashboard endpoint.
- Full CSV exports remain available from the Data Quality page and are the correct path for audit/export workflows.

Measured after the fix:

- `/api/devices?limit=50`: about 18 KB and roughly 29 ms median locally.
- `/api/data-quality`: about 1 KB and roughly 31 ms median locally.

Known heavier pages for controlled beta:

- `/devices`, `/inventory/[view]`, `/dashboard`, and `/data-quality` still compute whole-inventory review signals. This is acceptable for the current controlled beta data size, but broad rollout should revisit server-side aggregate helpers if those pages become painful.
- Avoid refreshing heavy review pages repeatedly on a weak network. Use focused category pages and CSV exports for deeper work.

### Phase 84 Release Gate

Before each controlled beta update:

1. Run `npm run backup`.
2. Run `npx prisma migrate status`.
3. Run `npx prisma migrate deploy`.
4. Run `npx prisma generate`.
5. Run `npm run doctor`.
6. Run `npm test`.
7. Run `npm run lint`.
8. Run `npm run build`.
9. Run `npm run jobs:run-due`.
10. Smoke `https://warehouse-it.local/api/health`, `/login`, protected-page redirects, Admin login, `/dashboard`, `/settings`, `/scan`, `/offline`, `/offline/conflicts`, `/data-quality`, `/reports`, logout, and post-logout protected-page access.
11. Confirm no secrets/runtime data are tracked by Git before pushing.

### Phase 84 Go Rules

- Controlled Team Beta is ready for Axel plus one trusted IT teammate.
- Use `https://warehouse-it.local` as the only normal beta URL.
- Keep QA records such as `QA-*`, `QA-PHASE-*`, and `QA Smoke Mouse` clearly labeled.
- Do not run `prisma migrate reset`, destructive seed, broad cleanup scripts, broad importer work, or source workbook imports during beta.
- Do not commit `.env`, SMTP credentials, `BITLOCKER_VAULT_SECRET`, BitLocker recovery keys, database files, uploads, backups, certificates, private keys, cookies, or logs.

### Phase 84 No-Go Rules

Do not expand beyond the controlled beta until:

- Real physical phone validation is completed and documented.
- Approved SMTP credentials are configured and one real QA email is sent.
- `BITLOCKER_VAULT_SECRET` is stored in an approved password manager.
- Optional `npm audit` / dependency review is reviewed for wider deployment risk.

Not included in Production V1: Offline stock issue/return, service worker caching, OCR expansion, SNMP printer/scale polling, UniFi API integration, direct Zebra printer sending, broad importer work, public tunnels, or a full offline inventory database.

## Phase 85 UI / UX Visual Polish + Accessibility

Phase 85 is a design and accessibility hardening pass only. It does not change business logic, data models, offline action types, import behavior, OCR, SNMP, UniFi, Zebra printing, or production rollout status.

Status color meanings:

| Meaning | Use |
| --- | --- |
| Neutral/default | Ordinary metadata, inactive records, or low-priority labels. |
| Success/synced | Healthy state, completed sync, safe pass, or successful action. |
| Warning/offline/pending | Queued offline work, due soon, review soon, or non-blocking attention. |
| Danger/conflict | Failed action, destructive action, missing/lost item, blocked state, or conflict. |
| Info/inventory/maintenance/admin | Contextual labels for inventory, maintenance, security/admin, or explanatory system state. |

Mobile UX expectations:

- Keep pages card-first on phones with large tap targets.
- Keep filters and technical details collapsible where possible.
- Avoid horizontal overflow at 320px, clipped buttons, and dense desktop tables as the primary mobile experience.
- Use visible status text with color; do not rely on color alone.
- Use clear CTAs: Save, Sync now, Create, Upload, Queue offline, Retry sync, Cancel queued action.
- Empty states should explain what happened, what to do next, and whether retry is safe.
- Icon-only controls need accessible labels through visible text, `aria-label`, `title`, or an associated label.

Offline UX notes:

- Pending, failed, conflict, synced, and total local counts should be easy to scan.
- Conflict reasons and next safe steps should be visible before technical details.
- Technical payloads remain hidden behind disclosure controls.
- Photo conflicts must keep the user-safe wording: `Local photo file is no longer available. Retake the photo before retrying.`

## Phase 86 Design System and UI Preview Lab

The UI Preview Lab is available to Admin users at `/admin/ui-preview`.

Purpose:

- Review common visual patterns without using real production data.
- Check status colors, badges, buttons, cards, alerts, forms, offline queue examples, conflict cards, empty states, and danger actions in one place.
- Test phone widths such as 430px, 390px, 360px, and 320px without needing SMTP, camera, warehouse Wi-Fi, or production inventory.

Safety rules:

- The UI Preview Lab is static sample UI only.
- It must not create records, upload files, send email, sync offline actions, reveal secrets, or change settings.
- It stays Admin-only and should not appear as a normal daily warehouse workflow.

Design-system rules:

- Use semantic tones: neutral, success, warning, danger, info, pending, synced, conflict, offline, admin/security, maintenance, and inventory.
- Color is not the only status signal. Every badge, alert, and card state needs text such as Healthy, Review, Pending, Conflict, Failed, Synced, Overdue, or Restricted.
- Use shared button variants for repeated actions: primary, secondary, subtle, success, warning, danger, and ghost.
- Use shared surfaces when practical: SectionCard, MobileCard, MetricCard, AlertPanel, and EmptyState.
- Keep mobile cards readable, wrap long asset tags, and avoid horizontal overflow at 320px.
- Keep technical details behind disclosure controls unless the user needs them immediately.

Do not do during beta:

- Do not run `prisma migrate reset`, destructive seed, broad import, broad cleanup, OCR expansion, SNMP polling, UniFi work, direct Zebra sending, or public tunnels.
- Do not commit `.env`, SMTP credentials, `BITLOCKER_VAULT_SECRET`, BitLocker recovery keys, database files, uploads, backups, certificates, private keys, or logs.

## Phase 88 Real Visual QA / Screenshot Polish

Phase 88 was a visual/layout/readability pass only. No workflows, offline action types, service worker caching, OCR, SNMP, UniFi, Zebra printing, SMTP, BitLocker behavior, database models, or production phone-validation work were added.

Validation approach:

- A temporary authenticated local session was used for read-only route smoke and then deleted.
- Required pages returned 200: `/dashboard`, `/scan`, `/devices`, QA asset detail, `/offline`, `/offline/conflicts`, `/offline/move`, `/data-quality`, `/reports`, `/settings`, and `/admin/ui-preview`.
- Optional pages also returned 200: `/stock`, `/maintenance`, `/facturas`, `/admin/users`, `/admin/bitlocker`, `/backups`, and `/jobs`.
- The embedded browser screenshot pass was blocked by the known local `127.0.0.1:3000` redirect-loop/browser-state issue. Do not treat Phase 88 as real screenshot evidence on the beta phone.

Polish applied:

- Shared action buttons now preserve icon sizing and wrap long labels more safely.
- Page headers and status badges are more resilient to long text at phone widths.
- Offline sync record rows use an ASCII-safe separator to avoid mojibake.

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
APP_BASE_URL=https://warehouse-it.local
```

Use `SMTP_FROM` for the sender address. `MAIL_FROM` is accepted as a fallback for older local setup notes. If the company SMTP relay does not require authentication, leave both `SMTP_USER` and `SMTP_PASS` blank; otherwise set both. Do not set only one.

Validation steps:

1. Run `npm run doctor` and confirm SMTP only warns when intentionally not configured.
2. Open `/settings` as Admin.
3. Confirm the SMTP status shows only sanitized fields: configured, host present, from present, port, secure mode, auth present, and `APP_BASE_URL`.
4. Send a test email only to a QA recipient first.
5. Confirm links in the email use `https://warehouse-it.local`, not localhost.
6. If sending fails, check SMTP host, port, secure mode, credentials, and company firewall/network rules. Common ports are `587` STARTTLS, `465` SSL, and `25` internal relay.

Do not send real employee receipts until the QA test email and one safe workflow receipt have been reviewed.

Phase 77 result:

- Real SMTP credentials were not present in the local `.env`, so no real provider send was attempted or claimed.
- `npm run doctor` and `/api/health` remain safe when degraded only for missing SMTP configuration.
- `/api/email/test` returns `401` unauthenticated, `403` for Viewer, and a skipped/safe result for Admin when SMTP is missing.
- Malformed JSON to `/api/email/test` returns a clear client error instead of a generic server error.
- Template tests cover assignment, asset loan, and RMA bodies, and verify `APP_BASE_URL` links without requiring SMTP credentials.
- Review `EmailLog` after QA sends. It may show recipient, subject, status, sanitized error, and message ID, but must not contain SMTP passwords, auth secrets, BitLocker vault secrets, or recovery keys.

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
