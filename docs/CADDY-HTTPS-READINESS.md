# Caddy HTTPS Readiness

Do not commit private certificates, keys, or local trust-store exports.

## Result Table

| Test ID | Device | Network | URL | Result | Notes | Bug ID if failed |
| --- | --- | --- | --- | --- | --- | --- |
| HTTPS-HOST-001 | Host PC | Local network | `https://warehouse-it.local` | PENDING | Confirm with browser or HTTP smoke on host. |  |
| HTTPS-PHONE-001 | Beta phone | Warehouse Wi-Fi | `https://warehouse-it.local` | PENDING | Must be tested on real phone. |  |
| HTTPS-CAMERA-001 | Beta phone | Warehouse Wi-Fi | `https://warehouse-it.local/scan` | PENDING | Camera permission must work on trusted HTTPS. |  |
| HTTPS-FALLBACK-001 | Beta phone | Warehouse Wi-Fi | LAN IP fallback | PENDING | Document only if hostname fails. |  |

## Required Checks

- Caddy is running.
- `https://warehouse-it.local` opens on host PC.
- Phone can open `https://warehouse-it.local`.
- Phone camera permission works on HTTPS.
- Certificate/trust issue is documented if present.
- Fallback LAN IP is documented only if needed.
- Canonical URL remains `https://warehouse-it.local`.

If the phone cannot resolve `warehouse-it.local`, document the DNS/hosts/router workaround and keep this as a blocker or setup task.

