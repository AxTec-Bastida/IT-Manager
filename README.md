# Warehouse IT Inventory

Phone-first warehouse IT inventory tracking with IPAM, camera scanning, read-only UniFi visibility, AP-based last known location, employees, and long-term asset assignments.

## What It Does

- Tracks device inventory with IP, MAC, VLAN, range, location, model, serial, status, assignment, notes, and timestamps.
- Tracks full asset inventory fields including asset tag, condition, employee assignment, purchase/warranty dates, area/department, and repair notes.
- Tracks consumables, peripherals, printer supplies, and spare parts by quantity with movement history.
- Records printer/fixed-asset maintenance history, parts used, cleaning dates, supply replacement dates, and next due dates.
- Generates central operational alerts for IPAM conflicts, low stock, printer maintenance, warranty expiration, missing assets seen online, and fixed/static asset movement anomalies.
- Stores asset photo metadata with files on disk for main photos, serial labels, MAC/IP labels, condition, damage, accessories, and other documentation.
- Tracks facturas/purchase records, attached factura PDFs/photos, linked assets, linked stock items, vendor details, PO numbers, costs, and warranty dates.
- Adds a lightweight IT Workspace for quick follow-up tasks, PO tracker notes, and common IT resource links.
- Manages employees and long-term assignment records with captured signatures.
- Defines reserved IP pools by category, VLAN, range, location, and active status.
- Validates IPv4 addresses strictly. For example, `192.168.163.280` is rejected because `280` is outside `0-255`.
- Suggests the first free IP in a selected pool and can reserve it immediately.
- Detects duplicate active/reserved IPs, duplicate active MACs, outside-range assignments, VLAN mismatches, and duplicate device names.
- Runs limited server-side ping/ARP scans and compares discovered addresses against inventory.
- Uses the phone camera to scan QR codes and barcodes for device labels, serial numbers, MACs, IP labels, and internal tags.
- Shows approximate last known asset locations on a warehouse map from read-only UniFi access point association data.
- Imports and exports CSV for devices, ranges, stock items, stock movements, maintenance records, facturas, tasks, PO tracker notes, tool links, conflicts, and scan results.
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
```

With Prisma SQLite, this resolves to `prisma/dev.db`.

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

Seed sample data:

```bash
npm run prisma:seed
```

Start development:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Useful Commands

```bash
npm run lint
npm test
npm run build
npm run prisma:generate
npm run prisma:seed
```

## Production Start

For internal production use, build once and run the optimized Next.js server:

```bash
npm install
npm run prisma:generate
npm run build
npm start
```

By default, the app runs on `http://localhost:3000`. For phone camera scanning, do not send phones directly to `http://server-ip:3000`. Put HTTPS in front of the app with Caddy or Nginx and have the proxy forward to `localhost:3000`.

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
- `/stock/new` create a stock item.
- `/stock/[id]` stock detail with quantity actions, movement history, and linked maintenance.
- `/alerts` central alert center with open, acknowledged, resolved, and ignored alerts.
- `/jobs` scheduled local job status, run-now controls, and recent job runs.
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
- `/map` warehouse floor map, AP markers, asset last known location pins, and last 5 location trails.
- `/map/ap-locations/new` configure access point map coordinates.
- `/missing` assets marked missing with last known AP-based location.
- `/conflicts` live conflict detection and suggested fixes.
- `/activity` history log.
- `/settings` defaults, scan limits, import/export.

## CSV Import/Export

Use `/settings` for CSV tools.

Workspace export types include `tasks`, `po-tracker`, and `tool-links`. These are export-only additions for this phase; CSV import for the workspace module is intentionally not included.

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

The response includes:

- `alertsCreated`
- `alertsUpdated`
- `alertsResolved`
- `alertsSkipped`
- `errors`

There are no scheduled background jobs yet. Run manual refresh after imports, inventory edits, UniFi syncs, maintenance updates, stock adjustments, or warranty updates.

### Conflict Alerts

Conflict alerts are created from the existing IPAM conflict logic:

- Duplicate IP
- Duplicate MAC
- IP outside assigned range
- VLAN mismatch
- Unknown active IP or unknown UniFi client when available
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

Then edit AP map locations from the map admin flow and assign each AP marker to a zone. A zone groups access points; it is not a precise map polygon.

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
- The latest read-only UniFi/AP location exists.

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

### Missing Asset Seen Online Alerts

If an asset is marked `Missing` and read-only UniFi data sees it online, the app creates a `MISSING_ASSET_SEEN_ONLINE` alert. The alert shows the asset, last AP, zone, last seen time, and map link when available.

### Map And Quick Scan Alert Context

The map shows alert context for location-related asset pins, including expected zone, actual zone, severity, and links back to the asset or alert. Quick Scan also shows open alerts, conflict status, warranty context, last known location, and map actions for scanned assets.

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
- IPAM conflict detection every 15 minutes
- Stock alert check every 60 minutes
- Printer maintenance check every 60 minutes
- Warranty check every 24 hours
- Fixed/static movement alert check every 30 minutes using existing stored location history and snapshots only

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

Local command:

```bash
npm run jobs:run-due
```

The command runs due jobs directly against the local SQLite database. Keep the normal app server running separately for users.

### Windows Task Scheduler

For an internal Windows PC/server, create a scheduled task that runs every 5 minutes.

Recommended action:

```text
Program/script:
C:\Program Files\nodejs\npm.cmd

Add arguments:
run jobs:run-due

Start in:
C:\Dev\warehouse-it-inventory
```

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

The app also has a database-level `running` lock on each job to avoid duplicate job runs.

### Scheduled Job Safety

Scheduled jobs intentionally do not:

- Call new UniFi API endpoints.
- Authenticate to UniFi.
- Modify UniFi clients, VLANs, APs, switch ports, firewall rules, Wi-Fi networks, or controller settings.
- Mark assets offline just because ping or network data is missing.

If one job fails, the runner logs a failed `JobRun`, updates the schedule error, continues with the next due job, and records activity.

## Asset Photos

Asset photos are stored as files on disk. SQLite stores only metadata such as file path, MIME type, caption, photo type, size, and primary-photo flag.

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
- Serial label
- MAC/IP label
- Condition
- Damage
- Accessories
- Return condition
- Other

Photos are stored in:

```text
uploads/assets
```

Photo API routes:

- `GET /api/devices/:id/photos`
- `POST /api/devices/:id/photos`
- `PATCH /api/devices/:id/photos/:photoId`
- `DELETE /api/devices/:id/photos/:photoId`
- `POST /api/devices/:id/photos/:photoId/primary`

The app validates file type and max size, generates a safe unique filename, and never trusts the original filename for storage.

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

Factura files are stored on disk, not in SQLite:

```text
uploads/facturas
```

Supported factura file types:

- PDF
- JPG/JPEG
- PNG
- WEBP

Workflow:

1. Open `/facturas/new`.
2. Enter the factura number, vendor, dates, amount, and warranty info.
3. Attach a PDF or photo of the factura.
4. Select assets and stock items to link.
5. Save.

Asset detail pages show linked factura information. Stock detail pages show linked factura information. Factura detail pages show linked assets, linked stock items, and linked stock movements.

CSV exports include:

- Device factura number, vendor, purchase date, cost, currency, warranty expiration, and photo count.
- Stock item factura number, vendor, and purchase date.
- Stock movement factura number and vendor.
- Full `facturas` export.

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

Camera scan requires a secure browser context. It works on `localhost`; for phones on an internal server, serve the app over HTTPS using an internal certificate or trusted reverse proxy. Mobile browsers usually block camera access on plain `http://server-ip`.

If the live camera scanner does not open:

- Make sure the phone URL is HTTPS, not plain HTTP.
- Check the browser/site camera permission and allow camera access.
- Use the `/scan` page's `Scan from photo` fallback to capture or upload a label photo.
- Use the manual field for Bluetooth/USB keyboard-wedge scanners.

The scanner runs on the server because browser JavaScript cannot reliably ping LAN devices. It uses OS `ping`, then attempts ARP and reverse DNS where available.

Expected limitations:

- Some devices block ICMP/ping.
- ARP visibility depends on the server network segment and OS permissions.
- Scans are capped by `maxScanSize` in Settings to avoid accidental large sweeps.
- Non-responsive inventory devices are not automatically marked offline.

## Map-Based Last Known Location

The `/map` page shows approximate asset locations using read-only UniFi client association data. It does not perform GPS, triangulation, or exact indoor positioning. The app stores which UniFi access point an inventory asset was last associated with, then places the asset near that AP marker on the warehouse map.

The feature is intentionally read-only relative to UniFi:

- It can consume UniFi client/AP association data.
- It stores local snapshots and location history in SQLite.
- It does not modify UniFi devices, clients, networks, APs, aliases, VLANs, or settings.

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

The map image is displayed as a background. AP and asset pins use percentage coordinates, where:

- `x = 0` is the left edge.
- `x = 100` is the right edge.
- `y = 0` is the top edge.
- `y = 100` is the bottom edge.

### Configure AP Coordinates

Open `/map/ap-locations/new` and create one marker per UniFi AP.

Required fields:

- AP name
- AP MAC address
- Location label
- X coordinate
- Y coordinate

Optional fields:

- UniFi device ID
- Floor name
- Notes
- Map assignment

The AP MAC should match the connected AP MAC coming from UniFi client data. If the AP is not mapped, the app will not create a mapped asset location history row for that client.

### UniFi Location Sync Input

The read-only sync endpoint is:

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

Asset matching order:

1. MAC address
2. IP address
3. Device name/hostname

History rows are created only when:

- The asset has no prior location.
- The associated AP changed.
- Enough time passed since the last location row.
- The device was offline and is seen again.

This avoids duplicate history spam from repeated syncs on the same AP.

### Last Known And Last 5 Locations

On a device detail page, the `Last Known Location` section shows:

- Last seen date/time
- Last known UniFi AP
- Mapped location label
- Latest local UniFi online/offline snapshot
- `View on Map`
- `View Last 5 Locations`

The `/map?asset=<assetId>&history=5` view displays the last five AP-based positions and connects them with a line to show movement sequence.

### Missing Assets

Set a device status to `Missing` from the device edit page. Then open `/missing`.

Missing assets show:

- Assigned user/department
- Current status
- Last seen
- Last known AP-based location
- Current local UniFi online/offline snapshot
- View on Map
- Show Last 5 Locations

### Wi-Fi Location Limitations

- Location is approximate and tied to the last associated AP.
- A client may stay associated to an AP farther away than expected.
- AP association can lag behind physical movement.
- Some devices sleep, roam slowly, randomize MACs, or disconnect from Wi-Fi.
- Wired/static devices may have no UniFi Wi-Fi association.
- Signal strength is informational and should not be treated as exact distance.

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
npm run prisma:seed
npm run build
npm start
```

If Prisma migration is blocked on the Windows machine, use the included SQLite fallback after `npm run prisma:generate`:

```bash
node prisma/migrate-local.mjs
npm run prisma:seed
```

Keep regular backups of `prisma/dev.db`.

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
