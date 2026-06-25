import { AlertTriangle, CheckCircle2, Clock, LockKeyhole, Package, ShieldAlert, XCircle } from "lucide-react";
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
