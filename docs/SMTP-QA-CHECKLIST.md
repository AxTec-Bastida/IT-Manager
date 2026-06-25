# SMTP QA Checklist

Do not place SMTP credentials in this file. Do not send to real employees unless the recipient is approved. Use a QA mailbox.

## Result Table

| Test ID | SMTP Status | QA Recipient | Email Type | Result | EmailLog Status | Notes | Bug ID if failed |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SMTP-DOCTOR-001 | Configured locally |  | Doctor status | PASS | N/A | `npm run doctor` reports SMTP configured in this environment. |  |
| SMTP-TEST-001 |  |  | Test email | PENDING |  | Must be sent to approved QA mailbox and received. |  |
| SMTP-ASSIGN-001 |  |  | Assignment receipt | PENDING |  | Send only if automation is enabled/configured for QA. |  |
| SMTP-LOAN-001 |  |  | Asset loan receipt | PENDING |  | Send only if automation is enabled/configured for QA. |  |
| SMTP-RMA-001 |  |  | RMA notification | PENDING |  | Manual send or export behavior only unless enabled. |  |

## Required SMTP Tests

- Doctor detects SMTP configured or missing.
- Test email sends to QA mailbox.
- QA mailbox receives test email.
- Assignment email preview/recipient logic works.
- Assignment email sends only if enabled/configured.
- Loan email sends only if enabled/configured.
- RMA email/export behavior works.
- Missing SMTP does not block records.
- Disabled automation does not auto-send.
- EmailLog records sent/skipped/failed status.

If SMTP credentials are unavailable, mark SMTP QA as PENDING and verify skipped/manual-first behavior only.

