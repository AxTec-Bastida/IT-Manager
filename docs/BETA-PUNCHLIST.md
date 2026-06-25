# Controlled Beta Punchlist

This is the live punchlist for the controlled Warehouse IT beta. Do not paste secrets, recovery keys, SMTP passwords, real facturas, production spreadsheets, or sensitive screenshots into this file.

## A. Current Build

| Field | Value |
| --- | --- |
| Phase | 90I Controlled Beta Execution |
| Commit | Base before Phase 90I commit: `7dfdd06 Harden final beta workflows and map zones` |
| Captured | 2026-06-25 15:03:36 -07:00 |
| Current beta URL | `https://warehouse-it.local` |
| Backup path | `C:\Dev\warehouse-it-inventory\backups\manual-20260625-150326` |
| Test result | 494 tests passed |
| Doctor result | PASS; SMTP is configured in this local environment |
| Build result | PASS |
| Migration status | 35 migrations, database schema up to date |
| Jobs result | PASS; 7 due jobs ran successfully on last run |
| HTTP smoke | PASS; public health 200, protected pages 307 redirect, guarded APIs 401 |

## B. Go / No-Go

| Scope | Status | Notes |
| --- | --- | --- |
| Controlled Team Beta | CONDITIONAL GO | Code verification is green. Real phone, real QA email, and approved BitLocker secret-storage evidence remain manual blockers. |
| Wider Rollout | NO-GO | Do not expand beyond controlled beta until manual blockers are closed and documented. |

## C. Open Blockers

| ID | Blocker | Status | Owner | Notes |
| --- | --- | --- | --- | --- |
| BLK-PHONE-001 | Real physical phone validation | OPEN | Warehouse IT | Must test the actual phone on `https://warehouse-it.local`; do not mark passed from workstation checks. |
| BLK-SMTP-001 | SMTP QA email sent and received | OPEN | Admin / IT | SMTP may be configured locally, but one approved QA email must be sent and received before closure. |
| BLK-BITLOCKER-001 | `BITLOCKER_VAULT_SECRET` stored in approved password manager | OPEN | Admin / Security | Doctor can verify env presence, but approved secret storage must be confirmed outside Git. |

## D. Manual QA Results

| Area | Status | Result Date | Tester | Notes / Bug ID |
| --- | --- | --- | --- | --- |
| Phone tests | PENDING |  |  | Use `docs/PHONE-QA-CHECKLIST.md`. |
| Camera tests | PENDING |  |  | Must include background/app-switch camera pause behavior. |
| Assignment tests | PENDING |  |  | Badge scan, asset scan, transfer warning, email skipped/sent behavior. |
| Intake tests | PENDING |  |  | Add One Asset, Bulk Receive, Pair Companion Devices. |
| Stock tests | PENDING |  |  | Restock, Physical Count / Adjustment, stock code lookup. |
| Labels tests | PENDING |  |  | Label preview/generator/download only; no direct Zebra network printing. |
| RMA tests | PENDING |  |  | Scan-first selected list and export review. |
| Facturas tests | PENDING |  |  | Lifecycle archive/void/linking; no sensitive files unless approved. |
| Maintenance tests | PENDING |  |  | Printer page counts, consumables, scale profile language. |
| Reports tests | PENDING |  |  | Export sanity and no secrets. |
| Admin/settings tests | PENDING |  |  | Admin Center, Master Data, IP Ranges, Email settings, no secret display. |

## E. Bugs Found

| ID | Severity | Area | Description | Reproduction Steps | Expected Result | Actual Result | Status | Owner | Fixed In Commit |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |  |  |  |

Severity values: Blocker, High, Medium, Low.

## F. Decision Log

| Date | Decision | Accepted / Deferred | Reason |
| --- | --- | --- | --- |
| 2026-06-25 | Controlled beta can proceed only as conditional GO. | Accepted | Code checks are green, but manual phone/SMTP/secret-storage blockers remain open. |
| 2026-06-25 | Do not claim real phone validation from source/tests. | Accepted | Real camera/browser behavior must be tested on the physical beta phone. |
| 2026-06-25 | Do not send production emails until QA recipient and provider are approved. | Accepted | Prevent accidental email spam or real-user notification. |

## G. Deferred Items

- OCR expansion.
- SNMP/live printer polling.
- UniFi integration.
- Direct Zebra network printing.
- Fingerprint/thumb scanning.
- Purchasing app integration.
- Broad reports module expansion.
- New real production data import.
- Full offline stock/RMA/factura/admin workflows.
