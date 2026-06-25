# Route Smoke Matrix

Protected redirects or 401/403 responses are expected when unauthenticated. Do not treat them as failures.

Last Phase 90I verification: base commit `7dfdd06`, 494 tests passed, build passed, public health returned 200, protected pages redirected with 307, and guarded APIs returned 401 while unauthenticated.

| Route | Expected unauthenticated behavior | Expected authenticated behavior | Status | Notes |
| --- | --- | --- | --- | --- |
| `/api/health` | 200 OK | 200 OK | PASS | Public health endpoint. |
| `/dashboard` | Redirect to login | Page loads | PASS | Unauthenticated redirect checked in Phase 90G. |
| `/scan` | Redirect to login | Page loads | PASS | Camera requires real phone QA. |
| `/devices` | Redirect to login | Page loads | PASS | Inventory hub. |
| `/devices/[id]` | Redirect to login | Asset detail loads or 404 for invalid id | PASS | Use a safe existing asset for manual QA. |
| `/intake` | Redirect to login | Page loads | PASS | Intake hub. |
| `/intake/assets/new` | Redirect to login | Page loads | PASS | Add One Asset. |
| `/intake/assets/bulk` | Redirect to login | Page loads | PASS | Bulk Receive Serialized Assets. |
| `/intake/pair` | Redirect to login | Page loads | PASS | Pair Companion Devices. |
| `/stock` | Redirect to login | Page loads | PASS | Stockroom. |
| `/stock/new` | Redirect to login | Page loads | PASS | Add New Stock Type. |
| `/stock/restock` | Redirect to login | Page loads | PASS | Restock Existing Item. |
| `/stock/count` | Redirect to login | Page loads | PASS | Physical Count / Adjustment. |
| `/labels` | Redirect to login | Page loads | PASS | Print Labels. |
| `/assignments/new` | Redirect to login | Page loads | PASS | Asset Assignment. |
| `/loans/new` | Redirect to login | Page loads | PASS | Asset loan form. |
| `/loans/quick-checkout` | Redirect to login | Page loads | PASS | Quick Asset Checkout. |
| `/rma` | Redirect to login | Page loads | PASS | RMA list. |
| `/rma/new` | Redirect to login | Page loads | PASS | RMA Draft. |
| `/maintenance` | Redirect to login | Page loads | PASS | Maintenance hub. |
| `/maintenance/scales` | Redirect to login | Page loads | PASS | Scale maintenance review. |
| `/facturas` | Redirect to login | Page loads | PASS | Factura list. |
| `/facturas/[id]` | Redirect to login | Factura detail loads or 404 for invalid id | PASS | Use safe existing factura for manual QA. |
| `/reports` | Redirect to login | Page loads | PASS | Reports hub. |
| `/data-quality` | Redirect to login | Page loads | PASS | Summary-first review. |
| `/admin` | Redirect to login | Admin-only page or forbidden panel | PASS | Admin Center. |
| `/admin/master-data` | Redirect to login | Admin-only page or forbidden panel | PASS | Controlled lists. |
| `/admin/ip-ranges` | Redirect to login | Admin/allowed role page | PASS | IP ranges. |
| `/admin/ui-preview` | Redirect to login | Admin-only static preview | PASS | Static only. |
| `/admin/release-readiness` | Not present | Not present | N/A | No release-readiness page exists; docs are used instead. |
| `/settings` | Redirect to login | Admin-only status page | PASS | No secrets displayed. |
| `/map` | Redirect to login | Page loads | PASS | Map/Zones clarity updated. |
| `/zones` | Redirect to login | Page loads | PASS | Zone explanation updated. |
| `/resources` | Redirect to `/tools` after auth | Redirects to `/tools` | PASS | Legacy route redirects. |
| `/resources/new` | Redirect to `/tools/new` after auth | Redirects to `/tools/new` | PASS | Legacy route redirects. |
| `/api/facturas` | 401 Unauthorized | JSON list if permitted | PASS | Guarded API. |
| `/api/export/po-requisition-formato` | 401 Unauthorized | CSV if permitted | PASS | Guarded export. |
| `/api/zones` | 401 Unauthorized | JSON if permitted | PASS | Guarded API. |
