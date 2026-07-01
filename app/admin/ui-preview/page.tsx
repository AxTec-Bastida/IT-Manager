import { AlertTriangle, CheckCircle2, Clock, LockKeyhole, Package, ShieldAlert, XCircle, Boxes, Handshake, FileSpreadsheet, Plus, Search, Tags } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/badge";
import { ForbiddenPanel } from "@/components/forbidden-panel";
import { PageHeader } from "@/components/page-header";
import { ActionGrid, ActionLink, AlertPanel, EmptyState, KeyValueGrid, MetricCard, MobileCard, PageActions, PolishedCard, SectionCard, actionButtonClass, type ActionVariant } from "@/components/ui-patterns";
import { hasPageRole } from "@/lib/page-permissions";

export const dynamic = "force-dynamic";

const tones: Array<{ tone: BadgeTone; label: string; helper: string }> = [
  { tone: "neutral", label: "Neutral", helper: "Ordinary metadata or inactive records." },
  { tone: "success", label: "Success", helper: "Completed, safe, healthy, or available." },
  { tone: "warning", label: "Warning", helper: "Needs review soon or due soon." },
  { tone: "danger", label: "Danger", helper: "Failed, blocked, destructive, missing, or lost." },
  { tone: "info", label: "Info", helper: "System context or supporting detail." },
  { tone: "pending", label: "Pending", helper: "Waiting, queued, or not finished yet." },
  { tone: "synced", label: "Synced", helper: "Offline action synced successfully." },
  { tone: "conflict", label: "Conflict", helper: "Needs human review before retry." },
  { tone: "offline", label: "Offline", helper: "Local queued work or offline-only state." },
  { tone: "security", label: "Security", helper: "Admin, restricted, or protected area." },
  { tone: "maintenance", label: "Maintenance", helper: "Printer, scale, or service work." },
  { tone: "inventory", label: "Inventory", helper: "Asset, stock, label, or intake context." },
];

const buttons: Array<{ variant: ActionVariant; label: string; helper: string }> = [
  { variant: "primary", label: "Primary", helper: "Main save/create/sync action." },
  { variant: "secondary", label: "Secondary", helper: "Normal navigation or support action." },
  { variant: "subtle", label: "Subtle", helper: "Low-emphasis action in a dense card." },
  { variant: "success", label: "Success", helper: "Confirm healthy or complete state." },
  { variant: "warning", label: "Warning", helper: "Review before continuing." },
  { variant: "danger", label: "Danger", helper: "Cancel, delete, retire, or destructive action." },
  { variant: "ghost", label: "Ghost", helper: "Quiet link-like action." },
];

const assetBadges: Array<{ label: string; tone: BadgeTone }> = [
  { label: "Available", tone: "success" },
  { label: "Assigned", tone: "inventory" },
  { label: "Loaned", tone: "warning" },
  { label: "Missing", tone: "danger" },
  { label: "Retired", tone: "neutral" },
  { label: "Decommissioned", tone: "neutral" },
  { label: "Healthy", tone: "success" },
  { label: "Review", tone: "warning" },
  { label: "Pending", tone: "pending" },
  { label: "Synced", tone: "synced" },
  { label: "Failed", tone: "danger" },
  { label: "Conflict", tone: "conflict" },
  { label: "Overdue", tone: "danger" },
  { label: "Due Soon", tone: "warning" },
  { label: "Admin", tone: "admin" },
  { label: "Restricted", tone: "security" },
];

const offlineExamples = [
  { title: "Move queued", status: "Pending", tone: "offline" as BadgeTone, detail: "GHT-LP-011 to Packing / Rack 2", icon: Clock },
  { title: "Move synced", status: "Synced", tone: "synced" as BadgeTone, detail: "GHT-SLD-190 location updated", icon: CheckCircle2 },
  { title: "Note failed", status: "Failed", tone: "danger" as BadgeTone, detail: "Server rejected stale action. Review before retry.", icon: XCircle },
  { title: "Photo queued", status: "Pending photo", tone: "pending" as BadgeTone, detail: "Overview photo waiting for connection", icon: Package },
  { title: "Photo conflict", status: "Missing blob", tone: "conflict" as BadgeTone, detail: "Local photo file is no longer available. Retake the photo before retrying.", icon: AlertTriangle },
];

const conflictExamples = [
  { code: "MISSING_ASSET", title: "Missing asset", next: "Search inventory, then mark reviewed or create a task." },
  { code: "PERMISSION_DENIED", title: "Permission denied", next: "Ask an admin to review permissions before retrying." },
  { code: "STALE_LOCATION", title: "Stale location", next: "Open the asset and compare the current location." },
  { code: "INVALID_TARGET", title: "Invalid target", next: "Choose a valid zone, area, or location before retrying." },
  { code: "MISSING_PHOTO_BLOB", title: "Missing photo blob", next: "Retake the photo on the same device before retrying." },
];

export default async function UiPreviewPage() {
  if (!(await hasPageRole("ADMIN"))) return <ForbiddenPanel message="UI Preview Lab is admin-only." />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="UI Preview Lab"
        description="Static design-system samples for beta polish. This page does not mutate data, upload files, send email, or require production inventory."
        action={
          <PageActions>
            <ActionLink href="/settings">Settings</ActionLink>
            <ActionLink href="/dashboard" variant="primary">Dashboard</ActionLink>
          </PageActions>
        }
      />

      <AlertPanel title="Preview-only safety" tone="info">
        Use this lab to review visual patterns at phone widths, desktop widths, and during accessibility passes. Every sample includes text labels so color is never the only status signal.
      </AlertPanel>

      <PreviewSection title="Phase 89 Shell Polish" description="Final beta polish patterns for bounded page width, calm cards, action wrapping, and scan-first phone layouts.">
        <div className="grid gap-3 lg:grid-cols-2">
          <PolishedCard
            eyebrow="Operational card"
            title="Warehouse-ready card header"
            description="Titles wrap, helper text stays readable, and actions stack on phones before becoming a compact row on desktop."
            action={
              <ActionGrid className="lg:justify-end">
                <ActionLink href="/scan" variant="primary">Scan label</ActionLink>
                <ActionLink href="/devices">Open inventory</ActionLink>
              </ActionGrid>
            }
          >
            <KeyValueGrid
              items={[
                { label: "Route", value: "/scan", helper: "Primary phone workflow" },
                { label: "Tap target", value: "48px minimum button height", helper: "Large enough for warehouse use" },
                { label: "Sensitive data", value: "Not displayed", helper: "No secrets in visual QA samples" },
              ]}
            />
          </PolishedCard>
          <PolishedCard
            eyebrow="Daily use"
            title="Clean action density"
            description="Primary work stays obvious without filling every card with every possible action."
          >
            <ActionGrid>
              <button type="button" className={actionButtonClass("primary")}>Open record</button>
              <button type="button" className={actionButtonClass("secondary")}>Create task</button>
              <button type="button" className={actionButtonClass("subtle")}>More actions</button>
            </ActionGrid>
          </PolishedCard>
        </div>
      </PreviewSection>

      <PreviewSection title="Color / Status Tokens" description="Semantic tones used across operational cards, badges, and alerts. Names describe meaning, not raw color.">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {tones.map((item) => (
            <MobileCard key={item.tone} className="space-y-2">
              <Badge tone={item.tone}>{item.label}</Badge>
              <p className="text-sm text-slate-600">{item.helper}</p>
            </MobileCard>
          ))}
        </div>
      </PreviewSection>

      <PreviewSection title="Buttons" description="Tap-safe button/link variants. Primary actions stay obvious; destructive actions use danger language and styling.">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {buttons.map((button) => (
            <div key={button.variant} className="rounded-lg border border-slate-200 bg-white p-4">
              <button type="button" className={actionButtonClass(button.variant, "w-full")}>{button.label}</button>
              <p className="mt-2 text-sm text-slate-600">{button.helper}</p>
            </div>
          ))}
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <button type="button" disabled className={actionButtonClass("secondary", "w-full")}>Disabled</button>
            <p className="mt-2 text-sm text-slate-600">Disabled state must still be readable and non-interactive.</p>
          </div>
        </div>
      </PreviewSection>

      <PreviewSection title="Badges" description="Common operational badges with explicit text labels. Badges should wrap rather than forcing horizontal scroll.">
        <div className="flex flex-wrap gap-2">
          {assetBadges.map((badge) => <Badge key={badge.label} tone={badge.tone}>{badge.label}</Badge>)}
        </div>
      </PreviewSection>

      <PreviewSection title="Cards and Empty States" description="Reusable card surfaces for summaries, actions, and calm empty states.">
        <div className="grid gap-3 lg:grid-cols-3">
          <MetricCard label="Open alerts" value={7} helper="Needs attention, not panic." />
          <MetricCard label="Synced offline actions" value={14} helper="Healthy local queue history." className="border-emerald-200 bg-emerald-50" />
          <MetricCard label="Conflicts" value={2} helper="Review before retry." className="border-orange-200 bg-orange-50" />
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <EmptyState title="No offline actions" description="Nothing is waiting on this browser. Queue an action only when connection is unstable." action={<ActionLink href="/offline">Open Offline Queue</ActionLink>} />
          <EmptyState title="No search results" description="Try a different asset tag, serial, alias, model, or employee name." action={<ActionLink href="/scan">Open Quick Scan</ActionLink>} />
        </div>
      </PreviewSection>

      <PreviewSection title="Alerts" description="Status panels for user-facing outcomes and guardrails.">
        <div className="grid gap-3 md:grid-cols-2">
          <AlertPanel title="Saved successfully" tone="success">The record was saved. Email, upload, or offline sync can fail separately without losing the saved record.</AlertPanel>
          <AlertPanel title="Review before continuing" tone="warning">This action can affect audit history. Confirm the asset and borrower before saving.</AlertPanel>
          <AlertPanel title="Could not save record" tone="danger">Check the required fields and try again. If it repeats, capture the route and error text.</AlertPanel>
          <AlertPanel title="System note" tone="info">This is informational context, not a blocking error.</AlertPanel>
        </div>
      </PreviewSection>

      <PreviewSection title="Forms" description="Phone-friendly labels, tap targets, helper text, and visible validation expectations.">
        <form className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Asset tag</span>
            <input name="assetTagPreview" placeholder="GHT-LP-011" className="mt-1 min-h-12 w-full rounded-lg border border-slate-300 px-3 text-base" />
            <span className="mt-1 block text-xs text-slate-500">Use the label value exactly as scanned.</span>
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">Status</span>
            <select name="statusPreview" defaultValue="AVAILABLE" className="mt-1 min-h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base">
              <option value="AVAILABLE">Available</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="IN_REPAIR_RMA">In RMA / Repair</option>
            </select>
          </label>
          <label className="block md:col-span-2">
            <span className="text-sm font-semibold text-slate-700">Notes</span>
            <textarea name="notesPreview" rows={3} placeholder="Optional context for the next IT person" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base" />
          </label>
          <div className="grid gap-2 md:col-span-2 sm:grid-cols-2">
            <button type="button" className={actionButtonClass("primary")}>Save preview</button>
            <button type="button" className={actionButtonClass("secondary")}>Cancel</button>
          </div>
        </form>
      </PreviewSection>

      <PreviewSection title="Tables and Mobile Cards" description="Desktop tables are secondary; mobile cards carry the core daily workflow.">
        <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white md:block">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Asset</th>
                <th className="px-4 py-3">Tag</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Attention</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              <tr>
                <td className="px-4 py-3 font-medium text-slate-950">DELL Latitude 5520</td>
                <td className="px-4 py-3">GHT-LP-011</td>
                <td className="px-4 py-3"><Badge tone="success">Available</Badge></td>
                <td className="px-4 py-3"><Badge tone="warning">Missing photos</Badge></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="grid gap-3 md:hidden">
          <MobileCard>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-950">DELL Latitude 5520</p>
                <p className="mt-1 text-sm text-slate-600">GHT-LP-011 / Serial GLF54B3</p>
              </div>
              <Badge tone="success">Available</Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone="warning">Missing photos</Badge>
              <Badge tone="inventory">Laptop</Badge>
            </div>
            <div className="mt-4">
              <ActionLink href="/devices" variant="primary" className="w-full">Open asset</ActionLink>
            </div>
          </MobileCard>
        </div>
      </PreviewSection>

      <PreviewSection title="Offline Queue Examples" description="Static examples only. These do not create OfflineSyncRecord data.">
        <div className="grid gap-3 lg:grid-cols-2">
          {offlineExamples.map((example) => {
            const Icon = example.icon;
            return (
              <MobileCard key={example.title}>
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-slate-100 p-3 text-slate-700"><Icon size={18} /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-950">{example.title}</h3>
                      <Badge tone={example.tone}>{example.status}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{example.detail}</p>
                  </div>
                </div>
              </MobileCard>
            );
          })}
        </div>
      </PreviewSection>

      <PreviewSection title="Offline Conflict Examples" description="Conflict cards should show the issue and the next safe step before technical details.">
        <div className="grid gap-3 lg:grid-cols-2">
          {conflictExamples.map((conflict) => (
            <MobileCard key={conflict.code}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="conflict">{conflict.code}</Badge>
                <Badge tone="warning">Open review</Badge>
              </div>
              <h3 className="mt-3 font-semibold text-slate-950">{conflict.title}</h3>
              <p className="mt-1 rounded-lg border border-sky-100 bg-sky-50 p-3 text-sm font-medium text-sky-950">Next safe step: {conflict.next}</p>
              <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                <summary className="min-h-10 cursor-pointer list-none font-semibold text-slate-800">Technical details</summary>
                <p className="mt-2 text-slate-600">clientActionId=preview-only / no server data created</p>
              </details>
            </MobileCard>
          ))}
        </div>
      </PreviewSection>

      <PreviewSection title="Asset Status and Danger Zone" description="Risky actions must use explicit labels and never rely on color alone.">
        <div className="grid gap-3 lg:grid-cols-2">
          <SectionCard>
            <div className="flex flex-wrap gap-2">
              <Badge tone="success">Available</Badge>
              <Badge tone="inventory">Assigned</Badge>
              <Badge tone="warning">In RMA</Badge>
              <Badge tone="danger">Lost</Badge>
              <Badge tone="neutral">Retired</Badge>
            </div>
            <p className="mt-3 text-sm text-slate-600">Use status text in every pill and card. A user should understand the state even without seeing the color.</p>
          </SectionCard>
          <SectionCard className="border-rose-200 bg-rose-50">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-rose-100 p-3 text-rose-800"><ShieldAlert size={18} /></div>
              <div>
                <h3 className="font-semibold text-rose-950">Danger action pattern</h3>
                <p className="mt-1 text-sm text-rose-900">Use explicit language and confirmation for delete, cancel, retire, decommission, and other risky operations.</p>
              </div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button type="button" className={actionButtonClass("danger")}>Cancel queued action</button>
              <button type="button" className={actionButtonClass("secondary")}>Keep record</button>
            </div>
          </SectionCard>
        </div>
      </PreviewSection>

      <PreviewSection title="Mobile Layout Stress Sample" description="Long tags, badges, and button stacks should wrap at 320px without horizontal overflow.">
        <MobileCard className="max-w-md">
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Mobile card</p>
              <h3 className="mt-1 break-words text-lg font-semibold text-slate-950">Zebra Scanner Sled with very long imported label GHT-SLD-000000190-REVIEW</h3>
              <p className="mt-1 break-words text-sm text-slate-600">Location / Last Seen: Packing Area / Battery Room Shelf 02</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="inventory">Sled</Badge>
              <Badge tone="warning">Pair review</Badge>
              <Badge tone="danger">Missing photos</Badge>
            </div>
            <div className="grid gap-2">
              <ActionLink href="/scan" variant="primary">Scan another label</ActionLink>
              <ActionLink href="/data-quality">Open review queue</ActionLink>
            </div>
          </div>
        </MobileCard>
      </PreviewSection>

      <PreviewSection title="Phase 90A Scan & Camera Patterns" description="Static preview samples for scanners, camera fallbacks, mobile in-page action menus, and phone-first scan workflow examples.">
        <div className="grid gap-4 md:grid-cols-2">
          {/* Scan result review card */}
          <MobileCard className="space-y-3">
            <Badge tone="success">Scan result found</Badge>
            <div>
              <h3 className="font-semibold text-slate-950">DELL Latitude 5420</h3>
              <p className="font-mono text-sm text-slate-600">Asset Tag: GHT-LP-011</p>
              <p className="text-xs text-slate-500 mt-1">Scanner automatically stopped after successful detection.</p>
            </div>
            <div className="grid gap-2 grid-cols-2">
              <ActionLink href="/devices" variant="primary" className="text-center">Open asset</ActionLink>
              <ActionLink href="/devices" className="text-center">Move / Relocate</ActionLink>
            </div>
          </MobileCard>

          {/* Camera fallback/error card */}
          <MobileCard className="space-y-2 border-rose-200 bg-rose-50/50">
            <h3 className="font-semibold text-rose-950">Camera scanner fallback</h3>
            <p className="text-sm text-rose-900">Camera preview could not start. Check browser permission or use Upload Photo.</p>
            <p className="text-xs text-rose-800 font-medium">Camera requires HTTPS on most phones. Use https://warehouse-it.local.</p>
            <div className="pt-2">
              <button type="button" className={actionButtonClass("secondary", "w-full")}>Upload Photo</button>
            </div>
          </MobileCard>

          {/* Manual scan fallback */}
          <MobileCard className="space-y-3">
            <h3 className="font-semibold text-slate-950">Manual scan input</h3>
            <p className="text-sm text-slate-600">Use this fallback if your camera is unavailable or you are using a handheld wedge scanner.</p>
            <div className="flex gap-2">
              <input readOnly value="GHT-LP-011" className="min-h-11 flex-1 rounded-lg border border-slate-300 px-3 text-sm" />
              <button type="button" className={actionButtonClass("primary")}>Lookup</button>
            </div>
          </MobileCard>

          {/* Phone-first scan workflow example */}
          <MobileCard className="space-y-3">
            <h3 className="font-semibold text-slate-950">Phone-first scan checklist</h3>
            <p className="text-sm text-slate-600">Scan employee badge followed by the asset tag to complete quick assignments.</p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 rounded bg-slate-50 p-2 text-slate-700">
                <span className="font-semibold">Step 1:</span> Scan borrower badge (Pending...)
              </div>
              <div className="flex items-center gap-2 rounded bg-slate-50 p-2 text-slate-400">
                <span className="font-semibold">Step 2:</span> Scan asset tag
              </div>
            </div>
          </MobileCard>

          {/* Mobile action menu / More actions pattern */}
          <MobileCard className="space-y-4 md:col-span-2">
            <h3 className="font-semibold text-slate-950">Mobile Collapsible Asset Actions (More Actions / Danger Zone)</h3>
            <p className="text-sm text-slate-600">Demonstrates the in-page non-obstructive actions card that replaced the floating panel.</p>
            <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-4">
              <div className="grid gap-2 grid-cols-2">
                <button type="button" className={actionButtonClass("secondary", "w-full")}>Scan label</button>
                <button type="button" className={actionButtonClass("primary", "w-full")}>Move / Relocate</button>
              </div>
              <details className="group border-t border-slate-100 pt-3">
                <summary className="flex min-h-11 cursor-pointer items-center justify-between text-sm font-semibold text-slate-700 list-none select-none">
                  <span>More actions</span>
                  <span className="text-xs text-slate-500 font-normal">Expand for Edit, Map, Tasks, RMA</span>
                </summary>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button type="button" className={actionButtonClass("secondary", "w-full")}>Edit Asset</button>
                  <button type="button" className={actionButtonClass("secondary", "w-full")}>View on Map</button>
                  <button type="button" className={actionButtonClass("secondary", "w-full")}>Add maintenance</button>
                  <button type="button" className={actionButtonClass("secondary", "w-full")}>Create Task</button>
                </div>
              </details>
              <div className="border-t border-rose-100 pt-3">
                <p className="text-xs font-semibold text-rose-500 uppercase tracking-wider mb-2">Danger Zone</p>
                <button type="button" className={actionButtonClass("danger", "w-full")}>Open controlled decommission</button>
              </div>
            </div>
          </MobileCard>
        </div>
      </PreviewSection>

      <PreviewSection title="Phase 90B Admin Center & Master Data Patterns" description="Static preview samples for master data lists, custom dropdowns, IP subnet pools, email settings, default values, and resource credentials.">
        <div className="grid gap-4 md:grid-cols-2">
          {/* Master Data List Row & Unknown Value Warning */}
          <MobileCard className="space-y-3">
            <h3 className="font-semibold text-slate-950">Master Data Controlled Row</h3>
            <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900">Laptop</span>
                <Badge tone="success">Active</Badge>
              </div>
              <p className="text-xs text-slate-500">Asset category used by 12 devices.</p>
              <div className="rounded border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900 flex gap-2">
                <AlertTriangle size={15} className="shrink-0 text-amber-700" />
                <p>This value is used by existing records. Deactivate it instead of deleting to preserve history.</p>
              </div>
            </div>
            <div className="rounded-lg border border-rose-200 bg-rose-50/50 p-3 text-xs text-rose-950 space-y-2">
              <p className="font-bold">Unknown Value Blocked</p>
              <p>Type &quot;Server&quot; is not a controlled value. Non-admin users are blocked from adding custom categories on forms.</p>
            </div>
          </MobileCard>

          {/* IP Range Pool Card */}
          <MobileCard className="space-y-3">
            <h3 className="font-semibold text-slate-950">IP Subnet Pool Manager Card</h3>
            <div className="rounded-lg border border-slate-200 bg-white p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-950 text-sm">Printer Subnet</h4>
                <Badge tone="success">Active</Badge>
              </div>
              <p className="text-xs text-slate-600">VLAN 20 • Location: IT Cage • Category: Printers</p>
              <p className="font-mono text-xs text-slate-900 bg-slate-50 px-2 py-1 rounded inline-block">192.168.20.1 - 192.168.20.254</p>
              <div className="rounded border border-rose-100 bg-rose-50/50 p-2 text-xs text-rose-900 flex gap-2">
                <AlertTriangle size={14} className="shrink-0 text-rose-700 mt-0.5" />
                <p>Overlap warning: This subnet range overlaps with another active range (192.168.20.0/24).</p>
              </div>
            </div>
          </MobileCard>

          {/* Email Settings & SMTP Warning */}
          <MobileCard className="space-y-3">
            <h3 className="font-semibold text-slate-950">Email Automation Diagnostics</h3>
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-950 flex gap-2">
              <ShieldAlert className="size-4 text-rose-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Email sending is disabled until SMTP is configured.</p>
                <p className="mt-0.5">System will skip email delivery tasks gracefully without crashing operational forms.</p>
              </div>
            </div>
            <div className="divide-y divide-slate-100 text-xs">
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">SMTP Host</span>
                <span className="font-mono font-semibold text-slate-700">SMTP_HOST (Present)</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">SMTP Credentials</span>
                <span className="font-mono font-semibold text-slate-400">•••••••• (Hidden for security)</span>
              </div>
            </div>
          </MobileCard>

          {/* Defaults, Zones, Resources */}
          <MobileCard className="space-y-4">
            <h3 className="font-semibold text-slate-950">Defaults, Zones & Resource Flags</h3>
            <div className="grid gap-2 text-xs">
              <div className="p-2.5 bg-slate-50 rounded border border-slate-100">
                <span className="font-bold text-slate-900 block mb-0.5">Asset Tag Prefix</span>
                <span className="text-slate-500">Laptops pre-filled with: <strong>GHT-LP</strong></span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded border border-slate-100">
                <span className="font-bold text-slate-900 block mb-0.5">Warehouse Location Zones</span>
                <span className="text-slate-500">Group map anchors (e.g. IT Cage) to flag when static assets move.</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded border border-slate-100 flex items-center justify-between">
                <span className="font-bold text-slate-900">Requires user credentials flag</span>
                <Badge tone="security">Credentials Required</Badge>
              </div>
            </div>
          </MobileCard>
        </div>
      </PreviewSection>

      <PreviewSection title="Phase 90C Inventory Intake, Pairing & Sled Patterns" description="Static preview samples for the 7-card intake hub, smart asset tag suggestions, charger tracking, companion device pairing, and CSV bulk mapping.">
        <div className="grid gap-4 md:grid-cols-2">
          {/* Intake Hub 7-Card Preview */}
          <MobileCard className="space-y-3 md:col-span-2">
            <h3 className="font-semibold text-slate-950">Intake Hub Cards Sample</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-white p-3 flex gap-3">
                <div className="rounded bg-slate-950 p-2 text-white"><Plus size={16} /></div>
                <div>
                  <p className="font-bold text-sm text-slate-900">Add One Asset</p>
                  <p className="text-xs text-slate-500">Create one serialized device with full details.</p>
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3 flex gap-3">
                <div className="rounded bg-slate-950 p-2 text-white"><Boxes size={16} /></div>
                <div>
                  <p className="font-bold text-sm text-slate-900">Bulk Receive Serialized Assets</p>
                  <p className="text-xs text-slate-500">Match internal asset tags to serials in bulk.</p>
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3 flex gap-3">
                <div className="rounded bg-slate-950 p-2 text-white"><Handshake size={16} /></div>
                <div>
                  <p className="font-bold text-sm text-slate-900">Pair Companion Devices</p>
                  <p className="text-xs text-slate-500">Pair existing sleds with iPods/iPhones.</p>
                </div>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex gap-3">
                <div className="rounded bg-amber-100 p-2 text-amber-900"><FileSpreadsheet size={16} /></div>
                <div>
                  <p className="font-bold text-sm text-slate-900">Import History</p>
                  <p className="text-xs text-slate-500">Admin only. Review legacy sheets.</p>
                </div>
              </div>
            </div>
          </MobileCard>

          {/* Tag suggestion card */}
          <MobileCard className="space-y-3">
            <h3 className="font-semibold text-slate-950">Smart Asset Tag Suggestion</h3>
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-600">Asset Tag</label>
              <input readOnly value="" placeholder="GHT-LP-..." className="min-h-10 w-full rounded border border-slate-300 px-3 text-sm bg-white" />
              <div className="flex items-center gap-2 rounded-md bg-slate-50 border border-slate-200 px-3 py-2 text-xs">
                <span className="text-slate-600">Suggested: <strong>GHT-LP-012</strong></span>
                <button type="button" className="ml-auto rounded bg-slate-950 px-2 py-1 font-semibold text-white">Use suggested tag</button>
              </div>
            </div>
          </MobileCard>

          {/* Charger Tracking Option */}
          <MobileCard className="space-y-3">
            <h3 className="font-semibold text-slate-950">Laptop Charger Option</h3>
            <div className="flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-3">
              <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-slate-300" />
              <label className="text-sm font-medium text-slate-700">
                Has charger
                <span className="ml-1 font-normal text-slate-500 block text-xs">— Charger included with this laptop</span>
              </label>
            </div>
          </MobileCard>

          {/* Bulk mode tab selector */}
          <MobileCard className="space-y-3">
            <h3 className="font-semibold text-slate-950">Bulk Mode Selectors</h3>
            <div className="flex border-b border-slate-200">
              <button type="button" className="border-b-2 border-slate-950 px-4 py-2 text-sm font-medium text-slate-950">Mode A: Sequence Range</button>
              <button type="button" className="border-b-2 border-transparent px-4 py-2 text-sm font-medium text-slate-400">Mode B: CSV Mapping</button>
            </div>
          </MobileCard>

          {/* Mapping CSV Preview and Validation */}
          <MobileCard className="space-y-3">
            <h3 className="font-semibold text-slate-950">Bulk CSV Upload Validation</h3>
            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 font-semibold uppercase">
                  <tr>
                    <th className="p-2">Row</th>
                    <th className="p-2">Tag</th>
                    <th className="p-2">Serial</th>
                    <th className="p-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="p-2 text-slate-500">1</td>
                    <td className="p-2 font-medium">GHT-LP-012</td>
                    <td className="p-2 text-slate-600">GLF54B3</td>
                    <td className="p-2"><Badge tone="success">Ready</Badge></td>
                  </tr>
                  <tr className="bg-amber-50/50">
                    <td className="p-2 text-slate-500">2</td>
                    <td className="p-2 font-medium">GHT-LP-011</td>
                    <td className="p-2 text-slate-600">GLF54B4</td>
                    <td className="p-2"><Badge tone="warning">Asset Exists</Badge></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </MobileCard>

          {/* Companion devices pairing flow */}
          <MobileCard className="space-y-3">
            <h3 className="font-semibold text-slate-950">Companion Devices Pairing</h3>
            <div className="space-y-2 text-xs">
              <div className="rounded border border-green-200 bg-green-50 p-2.5 flex justify-between items-center">
                <div>
                  <p className="font-semibold text-slate-900">Device 1: iPod (GHT-IPO-130)</p>
                  <p className="text-slate-500">iPod Touch 7th Gen</p>
                </div>
                <Badge tone="success">Selected</Badge>
              </div>
              <div className="rounded border border-slate-200 bg-slate-50 p-2.5 flex justify-between items-center">
                <div>
                  <p className="font-semibold text-slate-900">Device 2: Sled (Search or Scan)</p>
                  <p className="text-slate-400">Scan or search the Infinite Peripherals sled...</p>
                </div>
                <Search size={14} className="text-slate-400" />
              </div>
            </div>
          </MobileCard>

          {/* Success card */}
          <MobileCard className="space-y-3">
            <h3 className="font-semibold text-slate-950">Post-Intake Success Card</h3>
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-xs">
              <div className="flex items-center gap-2 text-green-800">
                <CheckCircle2 size={16} />
                <p className="font-bold">Asset created successfully</p>
              </div>
              <p className="mt-2 text-slate-600">GHT-LP-012 has been registered. You can print labels or add photos below.</p>
              <div className="mt-3 flex gap-2">
                <button type="button" className="rounded bg-slate-950 px-2.5 py-1.5 font-bold text-white">Generate Label</button>
                <button type="button" className="rounded border border-slate-300 bg-white px-2.5 py-1.5 font-bold text-slate-700">Add Photos</button>
              </div>
            </div>
          </MobileCard>
        </div>
      </PreviewSection>

      <PreviewSection title="Phase 90D Stock & Labels Rework" description="Preview of stockroom restock flows, physical count warning alerts, and label generator card options.">
        <div className="grid gap-4 md:grid-cols-2">
          {/* Restock Preview */}
          <MobileCard className="space-y-3">
            <h3 className="font-semibold text-slate-950 flex items-center gap-2">
              <Boxes size={18} />
              Stock Restock Form Preview
            </h3>
            <div className="space-y-3 text-sm">
              <div className="rounded-md bg-slate-50 p-3 border border-slate-200">
                <p className="font-bold text-slate-800">Item: CAT6 Ethernet Cable (STK-CAT6-10)</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500 block">Current stock:</span>
                    <span className="font-semibold text-slate-700 text-sm">120 units</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">New stock preview:</span>
                    <span className="font-semibold text-emerald-600 text-sm">170 units (+50)</span>
                  </div>
                </div>
              </div>
              <label className="block">
                <span className="text-xs font-semibold text-slate-700">Restock quantity</span>
                <input type="number" defaultValue={50} className="mt-1 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm bg-white" disabled />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-700">Link purchase factura</span>
                <select className="mt-1 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm bg-slate-50 text-slate-600" disabled>
                  <option>FAC-2026-0034 ($450.00 — 2026-06-20)</option>
                </select>
              </label>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs">
                <p className="font-bold text-emerald-800">Restocked successfully!</p>
                <p className="text-slate-600 mt-1">Transaction recorded as RESTOCK. STK-CAT6-10 total stock updated.</p>
              </div>
            </div>
          </MobileCard>

          {/* Physical Count Warning Preview */}
          <MobileCard className="space-y-3">
            <h3 className="font-semibold text-slate-950 flex items-center gap-2">
              <ShieldAlert size={18} />
              Physical Count Delta Warnings
            </h3>
            <div className="space-y-3 text-sm">
              <div className="rounded-md bg-rose-50 p-3 border border-rose-200">
                <p className="font-bold text-rose-800">Stock Discrepancy Detected</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-rose-600/80 block">Current registered:</span>
                    <span className="font-semibold text-slate-700 text-sm">85 units</span>
                  </div>
                  <div>
                    <span className="text-rose-600/80 block">Counted physical:</span>
                    <span className="font-semibold text-rose-600 text-sm">70 units (-15)</span>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-rose-200 bg-rose-50/50 p-3 text-xs">
                <p className="font-bold text-rose-800">Warning: Stock reduction</p>
                <p className="text-slate-600 mt-1">Reducing registered stock from 85 to 70 requires entering an audit reason below.</p>
              </div>
              <label className="block">
                <span className="text-xs font-semibold text-slate-700">Audit / adjustment reason (Required)</span>
                <select className="mt-1 min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm bg-white" defaultValue="DAMAGED" disabled>
                  <option value="DAMAGED">Damaged stock written off</option>
                  <option value="LOST">Lost / missing inventory</option>
                  <option value="ADJUSTMENT">General discrepancy adjustment</option>
                </select>
              </label>
            </div>
          </MobileCard>

          {/* Label Hub Selector Card Preview */}
          <div className="md:col-span-2 grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col h-full rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex items-start gap-2.5">
                <div className="shrink-0 rounded-lg p-2 bg-slate-950 text-white">
                  <Package size={16} />
                </div>
                <div className="min-w-0">
                  <h4 className="font-semibold text-slate-950 text-xs">Stock Items Mode</h4>
                  <p className="mt-0.5 text-[11px] text-slate-600 leading-normal">Print shelf bin labels for consumables, parts, and accessories.</p>
                </div>
              </div>
              <div className="mt-2 border-t border-slate-100 pt-2 text-[10px] text-slate-500">
                <strong>Size preset:</strong> Stock Shelf Label (4&quot; x 2&quot;)
              </div>
            </div>
            <div className="flex flex-col h-full rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex items-start gap-2.5">
                <div className="shrink-0 rounded-lg p-2 bg-slate-950 text-white">
                  <Tags size={16} />
                </div>
                <div className="min-w-0">
                  <h4 className="font-semibold text-slate-950 text-xs">Alias-linked Labels</h4>
                  <p className="mt-0.5 text-[11px] text-slate-600 leading-normal">Link physical labels (e.g. J01, J02) to device records.</p>
                </div>
              </div>
              <div className="mt-2 border-t border-slate-100 pt-2 text-[10px] text-slate-500">
                <strong>Best for:</strong> Sled/iPod barcode mapping.
              </div>
            </div>
            <div className="flex flex-col h-full rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex items-start gap-2.5">
                <div className="shrink-0 rounded-lg p-2 bg-slate-950 text-white">
                  <FileSpreadsheet size={16} />
                </div>
                <div className="min-w-0">
                  <h4 className="font-semibold text-slate-950 text-xs">Batch Pattern Sheets</h4>
                  <p className="mt-0.5 text-[11px] text-slate-600 leading-normal">Generate ranges with custom patterns (e.g. Zebra-{'{num}'}).</p>
                </div>
              </div>
              <div className="mt-2 border-t border-slate-100 pt-2 text-[10px] text-slate-500">
                <strong>Includes:</strong> Live count preview and prefix padding.
              </div>
            </div>
          </div>
        </div>
      </PreviewSection>

      <PreviewSection title="Phase 90E Beta Workflows Polish" description="Mocks representing the scan-first, mobile-friendly Assignments, Quick Loans, and RMA screens.">
        <div className="grid gap-4 md:grid-cols-2">
          
          {/* Card 1: Assignment Badge Scan & Employee Matched Card */}
          <MobileCard className="space-y-3">
            <Badge tone="inventory">Badge Scan & Lookup</Badge>
            <div className="flex gap-2">
              <input disabled className="flex-1 min-h-10 rounded-lg border border-slate-300 px-3 text-xs bg-slate-100" value="GHT-EMP-1094" />
              <button disabled className="px-3 bg-slate-200 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold">Lookup</button>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-900">Alejandro Bastida</p>
                <div className="text-[10px] text-slate-600 mt-0.5 space-y-0.5">
                  <p>Badge ID: GHT-EMP-1094</p>
                  <p>Email: abastida@g-global.com</p>
                  <p>Supervisor: supervisor.ops@g-global.com</p>
                </div>
              </div>
              <span className="text-emerald-700 text-xs font-semibold">✓ Matched</span>
            </div>
          </MobileCard>

          {/* Card 2: New Temporary Borrower Profile Mock */}
          <MobileCard className="space-y-3">
            <Badge tone="warning">New Temporary Borrower Form</Badge>
            <div className="p-3 border border-slate-200 bg-slate-50/50 rounded-xl space-y-2.5">
              <p className="text-[11px] text-amber-800 font-medium">⚠️ Badge not found. Confirm creation of temporary profile:</p>
              <div className="space-y-2">
                <input disabled className="w-full min-h-9 border border-slate-300 rounded-lg px-2 text-xs bg-white" value="John Doe (Temp)" />
                <input disabled className="w-full min-h-9 border border-slate-300 rounded-lg px-2 text-xs bg-slate-100" value="Badge ID: GHT-EMP-8889" />
                <input disabled className="w-full min-h-9 border border-slate-300 rounded-lg px-2 text-xs bg-white" placeholder="Email (Optional)" />
              </div>
              <div className="flex gap-1.5 pt-1">
                <button disabled className="flex-1 min-h-9 bg-slate-950 text-white rounded-lg text-xs font-semibold">Save Profile</button>
                <button disabled className="px-3 min-h-9 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold">Cancel</button>
              </div>
            </div>
          </MobileCard>

          {/* Card 3: Asset Scan / Selected Card & Transfer Warning */}
          <MobileCard className="space-y-3">
            <Badge tone="danger">Already Assigned Warning / Transfer</Badge>
            <div className="flex gap-2">
              <input disabled className="flex-1 min-h-10 rounded-lg border border-slate-300 px-3 text-xs bg-slate-100" value="GHT-LP-0255" />
              <button disabled className="px-3 bg-slate-200 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold">Add</button>
            </div>
            
            <div className="rounded-xl border border-rose-200 bg-rose-50/20 p-3 space-y-2.5">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold text-xs text-slate-900">MacBook Pro 16</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Tag: GHT-LP-0255 / SN: C02X8934LHD2</p>
                </div>
                <Badge tone="danger">Assigned</Badge>
              </div>
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg space-y-1.5">
                <p className="text-[10px] text-rose-950 font-semibold">⚠️ Currently Assigned to: Jane Smith (Operations)</p>
                <label className="flex items-center gap-1.5 text-[10px] font-bold text-rose-900 cursor-pointer">
                  <input type="checkbox" defaultChecked className="rounded border-rose-300 text-rose-900" disabled />
                  Confirm Transfer of Asset
                </label>
              </div>
              <label className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-700">
                <input type="checkbox" defaultChecked className="rounded border-slate-300 text-slate-900" disabled />
                Laptop Charger Included
              </label>
            </div>
          </MobileCard>

          {/* Card 4: Email Rules & SMTP Warnings */}
          <MobileCard className="space-y-3">
            <Badge tone="neutral">Email Preview & SMTP Warnings</Badge>
            
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
              <p className="font-bold text-slate-900">Assignment Email Recipients</p>
              <div className="text-slate-600 text-[11px] leading-relaxed">
                <p>• To: abastida@g-global.com (Assignee)</p>
                <p>• CC: supervisor.ops@g-global.com (Assignee Manager)</p>
                <p>• CC: it.techstyle@g-global.com (IT Mailbox)</p>
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1 text-xs">
              <p className="font-semibold text-amber-950 flex items-center gap-1">⚠️ SMTP Not Configured</p>
              <p className="text-amber-800 text-[10px] leading-relaxed">
                Assignment created. Email notification skipped because SMTP is not configured.
              </p>
            </div>
          </MobileCard>

          {/* Card 5: Quick Loan Selected Asset Card */}
          <MobileCard className="space-y-3">
            <Badge tone="warning">Quick Loan Selected Asset</Badge>
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold text-xs text-slate-900">Zebra TC57 Scanner</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Tag: GHT-SLD-0824 / SN: 18274A0914</p>
                </div>
                <Badge tone="success">Available</Badge>
              </div>
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1 text-slate-600">
                <p className="font-bold text-slate-900">Loan CC List</p>
                <p>• To: temp.borrower@g-global.com</p>
                <p>• CC: ops@g-global.com (OPS Mailbox)</p>
                <p>• CC: it.techstyle@g-global.com</p>
              </div>
            </div>
          </MobileCard>

          {/* Card 6: RMA Draft & Selected Devices */}
          <MobileCard className="space-y-3">
            <Badge tone="info">RMA Draft & Filter Mocks</Badge>
            <div className="space-y-2 text-xs">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 space-y-1">
                <p className="font-bold text-slate-900">RMA Draft Case: RMA-8812</p>
                <p className="text-slate-600 text-[10px]">Title: Batch Draft / Destination: Pending</p>
                <Badge tone="pending">Draft (Metadata fields optional)</Badge>
              </div>

              <div className="p-2.5 border border-slate-200 bg-white rounded-lg space-y-2">
                <p className="font-bold text-[11px] text-slate-800">RMA Selected Device (Scan-first list)</p>
                <div className="flex justify-between items-center text-[10px]">
                  <span>Tag: GHT-AP-0911 (Access Point)</span>
                  <span className="text-slate-400">Photo Attached: No</span>
                </div>
                <input disabled className="w-full min-h-8 border border-slate-300 rounded-lg px-2 text-[10px] bg-slate-50" value="Issue: Broken antenna mount" />
              </div>

              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[10px] text-amber-800">
                <strong>RMA Category Filter Rule:</strong> Selecting &quot;Phones&quot; strictly queries phones and excludes Access Points.
              </div>
            </div>
          </MobileCard>

          {/* Card 7: RMA Export Column Mocks */}
          <MobileCard className="md:col-span-2 space-y-2 text-xs">
            <Badge tone="neutral">RMA Export Columns Preview</Badge>
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="min-w-full divide-y divide-slate-200 text-[10px]">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-semibold">RMA #</th>
                    <th className="px-2 py-1.5 text-left font-semibold">Title</th>
                    <th className="px-2 py-1.5 text-left font-semibold">Asset Tag</th>
                    <th className="px-2 py-1.5 text-left font-semibold">Serial #</th>
                    <th className="px-2 py-1.5 text-left font-semibold">Category</th>
                    <th className="px-2 py-1.5 text-left font-semibold">Brand</th>
                    <th className="px-2 py-1.5 text-left font-semibold">Location</th>
                    <th className="px-2 py-1.5 text-left font-semibold">Damage</th>
                    <th className="px-2 py-1.5 text-left font-semibold">Photo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600">
                  <tr>
                    <td className="px-2 py-1.5 font-semibold text-slate-900">RMA-123</td>
                    <td className="px-2 py-1.5">Misfit sleds</td>
                    <td className="px-2 py-1.5 font-mono">GHT-SLD-01</td>
                    <td className="px-2 py-1.5 font-mono">18A98B09</td>
                    <td className="px-2 py-1.5">Scanner</td>
                    <td className="px-2 py-1.5">Zebra</td>
                    <td className="px-2 py-1.5">Shipping</td>
                    <td className="px-2 py-1.5">USB port bent</td>
                    <td className="px-2 py-1.5">Needs Photo</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </MobileCard>

        </div>
      </PreviewSection>

      <PreviewSection title="Phase 90F maintenance, factura, and printer patterns" description="Static examples for status-aware maintenance, safe factura lifecycle actions, linked value cards, printer records, and FORMATO-style requisition rows.">
        <div className="grid gap-4 lg:grid-cols-3">
          <MobileCard className="space-y-3">
            <Badge tone="info">Maintenance profile</Badge>
            <h3 className="font-semibold text-slate-950">Scale Active Profile</h3>
            <p className="text-sm text-slate-600">Active scales use 3-month checks. Stock/spare scales use yearly checks. Retired assets are excluded.</p>
            <div className="rounded-md bg-slate-50 p-3 text-sm">
              <p className="font-semibold text-slate-950">Due asset card</p>
              <p className="text-slate-600">Mettler Toledo BC60 / Packing / Next due Jul 15</p>
            </div>
          </MobileCard>
          <MobileCard className="space-y-3">
            <Badge tone="danger">Factura lifecycle</Badge>
            <h3 className="font-semibold text-slate-950">Linked factura cannot hard-delete</h3>
            <p className="text-sm text-slate-600">Archive hides a bad factura without breaking asset value history. Hard delete is blocked when assets, line items, files, tasks, or stock depend on it.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <button className="min-h-11 rounded-md border border-slate-300 bg-white text-sm font-semibold text-slate-700">Archive</button>
              <button className="min-h-11 rounded-md border border-rose-300 bg-rose-50 text-sm font-semibold text-rose-800">Mark void</button>
            </div>
          </MobileCard>
          <MobileCard className="space-y-3">
            <Badge tone="success">Asset value</Badge>
            <h3 className="font-semibold text-slate-950">Linked factura source</h3>
            <p className="text-sm text-slate-600">DELL Latitude 5520 / MXN 14,200 / Source: factura line item.</p>
            <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Missing factura state: link one later from asset edit or Facturas.</p>
          </MobileCard>
          <MobileCard className="space-y-3">
            <Badge tone="neutral">Printer record</Badge>
            <h3 className="font-semibold text-slate-950">Consumables & Page Counts</h3>
            <p className="text-sm text-slate-600">Manual page count 125430 / black toner 8% to 100% / part TN-850. No SNMP polling.</p>
          </MobileCard>
          <MobileCard className="space-y-3">
            <Badge tone="pending">PO FORMATO row</Badge>
            <p className="text-xs font-semibold text-slate-500">CANT / UM / DESCRIPCION DEL MATERIAL / MARCA Y/O MODELO / AREA DE USO / FECHA EN QUE LO NECESITA EN ALMACEN</p>
            <p className="text-sm text-slate-700">1 / PZA / Zebra scanner cable / CS6080 / Shipping / 2026-07-01</p>
          </MobileCard>
          <MobileCard className="space-y-3">
            <Badge tone="warning">Data Quality checks</Badge>
            <p className="text-sm text-slate-600">Maintenance due, excluded retired assets, archived factura links, printer records, and asset value gaps appear as summary-first review signals.</p>
          </MobileCard>
        </div>
      </PreviewSection>

      <PreviewSection title="Phase 90G final beta readiness patterns" description="Static examples for Map/Zones clarity, camera background pause, navigation cleanup, and release-readiness review.">
        <div className="grid gap-4 lg:grid-cols-3">
          <MobileCard className="space-y-3">
            <Badge tone="info">Map / Zones</Badge>
            <h3 className="font-semibold text-slate-950">Expected Location Zone</h3>
            <p className="text-sm text-slate-600">Map anchors are floor-plan coordinates. Zones are logical areas such as Packing, Receiving, IT Cage, Returns, Shipping, or Co-Production.</p>
            <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">FIXED_ASSET_MOVED appears when a fixed/static asset is recorded outside its expected zone.</p>
          </MobileCard>
          <MobileCard className="space-y-3">
            <Badge tone="warning">Camera paused</Badge>
            <h3 className="font-semibold text-slate-950">Background safety message</h3>
            <p className="text-sm text-slate-600">Camera paused while app was in the background. Tap Start camera to scan again.</p>
            <button type="button" className={actionButtonClass("primary")}>Start camera again</button>
          </MobileCard>
          <MobileCard className="space-y-3">
            <Badge tone="security">Release readiness</Badge>
            <h3 className="font-semibold text-slate-950">Final beta checklist</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
              <li>Protected routes require login.</li>
              <li>Exports avoid secrets and recovery keys.</li>
              <li>Phone pages avoid horizontal overflow at 320px.</li>
              <li>Real phone and SMTP validation remain external blockers.</li>
            </ul>
          </MobileCard>
        </div>
      </PreviewSection>

      <PreviewSection title="Phase 90J bilingual i18n patterns" description="Static examples for local English/Spanish labels, fallback behavior, enum display labels, and data that must not be translated.">
        <div className="grid gap-4 lg:grid-cols-3">
          <MobileCard className="space-y-3">
            <Badge tone="info">Language switcher</Badge>
            <h3 className="font-semibold text-slate-950">English / Español</h3>
            <p className="text-sm text-slate-600">POST /api/language stores the warehouse_locale cookie and reloads the current route without changing auth or permissions.</p>
            <div className="grid grid-cols-2 gap-2">
              <button className="min-h-11 rounded-md border border-slate-300 bg-white text-sm font-semibold text-slate-700">English</button>
              <button className="min-h-11 rounded-md bg-slate-950 text-sm font-semibold text-white">Español</button>
            </div>
          </MobileCard>
          <MobileCard className="space-y-3">
            <Badge tone="inventory">Translated UI chrome</Badge>
            <h3 className="font-semibold text-slate-950">Inventario</h3>
            <p className="text-sm text-slate-600">Elige el tipo de activo que quieres administrar y entra a una vista enfocada.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <button className="min-h-11 rounded-md bg-slate-950 text-sm font-semibold text-white">Escanear etiqueta</button>
              <button className="min-h-11 rounded-md border border-slate-300 bg-white text-sm font-semibold text-slate-700">Agregar activo</button>
            </div>
          </MobileCard>
          <MobileCard className="space-y-3">
            <Badge tone="success">Enum display mapping</Badge>
            <p className="text-sm text-slate-600">Machine value remains <code>ACTIVE</code>. Display label can be translated safely.</p>
            <div className="flex flex-wrap gap-2">
              <Badge tone="success">Active</Badge>
              <Badge tone="success">Activo</Badge>
            </div>
          </MobileCard>
          <MobileCard className="space-y-3">
            <Badge tone="warning">Do not translate user data</Badge>
            <p className="text-sm text-slate-600">Asset tags, serials, IPs, names, notes, factura data, and activity payloads remain exactly as stored.</p>
            <KeyValueGrid
              items={[
                { label: "Asset tag", value: "GHT-LP-011" },
                { label: "Serial", value: "GLC7MG3" },
                { label: "Employee", value: "Luis Rodriguez" },
              ]}
            />
          </MobileCard>
          <MobileCard className="space-y-3">
            <Badge tone="pending">English fallback</Badge>
            <p className="text-sm text-slate-600">If a Spanish key is missing, the app falls back to English instead of crashing or showing a raw key.</p>
            <div className="rounded-md bg-slate-50 p-3 text-sm">Fallback: Inventory Count / Audit</div>
          </MobileCard>
          <MobileCard className="space-y-3">
            <Badge tone="info">Manual links</Badge>
            <h3 className="font-semibold text-slate-950">Manual de Usuario Warehouse IT</h3>
            <p className="text-sm text-slate-600">Resources includes English and Spanish manual links. Spanish docs are maintained manually.</p>
            <ActionGrid>
              <ActionLink href="/manual/user">English manual</ActionLink>
              <ActionLink href="/manual/user?lang=es" variant="primary">Manual español</ActionLink>
            </ActionGrid>
          </MobileCard>
        </div>
      </PreviewSection>

      <AlertPanel title="Restricted page" tone="warning">
        <LockKeyhole size={16} className="mr-1 inline" />
        This preview lab is linked under Admin and guarded by <code>hasPageRole(&quot;ADMIN&quot;)</code>.
      </AlertPanel>
    </div>
  );
}


function PreviewSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <SectionCard className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>
      {children}
    </SectionCard>
  );
}
