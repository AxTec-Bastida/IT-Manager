# Phone QA Checklist

Use this checklist on the actual beta phone. Do not mark a test passed from workstation checks or automated tests.

## Result Table

| Test ID | Device | Browser | Tester | Date | Result | Notes | Bug ID if failed |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PHONE-LOGIN-001 |  |  |  |  | PENDING | Open `https://warehouse-it.local`. |  |
| PHONE-CAMERA-001 |  |  |  |  | PENDING | Live camera scan. |  |
| PHONE-BG-001 |  |  |  |  | PENDING | Background camera pause. |  |
| PHONE-PHOTO-001 |  |  |  |  | PENDING | Photo capture and fallback upload. |  |
| PHONE-WORKFLOW-001 |  |  |  |  | PENDING | Core workflow smoke. |  |

## Login and Navigation

- Open `https://warehouse-it.local`.
- Login works.
- Dashboard loads.
- Mobile drawer opens/closes.
- Bottom nav works.
- No horizontal overflow at 320px-430px.

## Camera and Scan

- `/scan` opens.
- Start camera scan works.
- Scan an asset tag, QR code, or barcode.
- Scanner stops after successful scan.
- No repeated scan loop.
- Result review appears.
- Scan another works.
- Cancel stops camera.
- Route change stops camera.

## Background Camera Behavior

1. Start camera.
2. Switch to another app or lock the phone.
3. Confirm the phone stops camera usage.
4. Return to browser.
5. Confirm camera does not auto-reopen.
6. Confirm the app shows: `Camera paused while app was in the background. Tap Start camera to scan again.`

## Photo

- Take photo opens preview.
- Capture works.
- Cancel stops camera.
- Upload fallback works.
- Black preview does not happen.
- Backgrounding stops camera.

## Core Phone Workflows

- Add One Asset.
- Bulk Receive preview.
- Pair Companion Devices.
- Stock restock/count.
- Label Generator.
- Assignment badge/asset scan.
- Quick Asset Checkout.
- RMA scan-first selected list.
- Asset detail mobile actions.

