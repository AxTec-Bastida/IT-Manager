"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Activity, AlertTriangle, BarChart3, BriefcaseBusiness, Camera, ChevronDown, ClipboardCheck, ClipboardList, Database, ExternalLink, FileSpreadsheet, LayoutDashboard, ListChecks, LogOut, Map, MapPinned, MoreHorizontal, Package, PackageCheck, PackagePlus, Palette, Radar, ReceiptText, RotateCcw, Router, ScanLine, SearchX, Settings, ShieldCheck, Tags, Users, Warehouse, Wrench, type LucideIcon } from "lucide-react";
import { clsx } from "clsx";

const primaryLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/scan", label: "Quick Scan", icon: ScanLine },
  { href: "/devices", label: "Inventory", icon: Database },
  { href: "/alerts", label: "Alerts", icon: AlertTriangle },
  { href: "/workspace", label: "IT Workspace", icon: BriefcaseBusiness },
];

const navGroups = [
  {
    label: "Workflows",
    links: [
      { href: "/intake", label: "Inventory Intake", icon: PackagePlus },
      { href: "/assignments", label: "Assignments", icon: ClipboardCheck },
      { href: "/loans", label: "Asset Loans", icon: ClipboardList },
      { href: "/rma", label: "RMA / Repair", icon: PackageCheck },
      { href: "/stock", label: "Stockroom", icon: Package },
      { href: "/stock/issue", label: "Issue / Loan Item", icon: PackageCheck },
      { href: "/stock/issues", label: "Issue History", icon: ClipboardList },
      { href: "/maintenance", label: "Maintenance", icon: Wrench },
    ],
  },
  {
    label: "Workspace",
    links: [
      { href: "/tasks", label: "Quick Tasks", icon: ClipboardList },
      { href: "/po-tracker", label: "PO Tracker", icon: ReceiptText },
      { href: "/reports", label: "Reports", icon: BarChart3 },
      { href: "/tools", label: "Resources", icon: ExternalLink },
      { href: "/offline", label: "Offline Queue", icon: RotateCcw },
      { href: "/offline/conflicts", label: "Offline Conflicts", icon: AlertTriangle },
    ],
  },
  {
    label: "Records",
    links: [
      { href: "/employees", label: "Employees", icon: Users },
      { href: "/temporary-borrowers", label: "Temp Borrowers", icon: Users },
      { href: "/facturas", label: "Facturas", icon: ReceiptText },
      { href: "/map", label: "Map", icon: Map },
      { href: "/zones", label: "Zones", icon: MapPinned },
      { href: "/missing", label: "Missing", icon: SearchX },
    ],
  },
  {
    label: "Admin",
    links: [
      { href: "/settings", label: "Settings", icon: Settings },
      { href: "/admin/ui-preview", label: "UI Preview Lab", icon: Palette },
      { href: "/admin/users", label: "Users", icon: Users },
      { href: "/import/legacy-sheet", label: "Legacy Import", icon: FileSpreadsheet },
      { href: "/data-quality", label: "Data Quality", icon: ShieldCheck },
      { href: "/photos/compliance", label: "Photo Compliance", icon: Camera },
      { href: "/labels", label: "Labels", icon: Tags },
      { href: "/backups", label: "Backups", icon: Database },
      { href: "/jobs", label: "Jobs", icon: ListChecks },
      { href: "/ranges", label: "Ranges", icon: Router },
      { href: "/scanner", label: "Scanner", icon: Radar },
      { href: "/conflicts", label: "Conflicts", icon: AlertTriangle },
      { href: "/activity", label: "Activity", icon: Activity },
    ],
  },
];

type NavUser = { name: string; role: "ADMIN" | "IT_STAFF" | "VIEWER" | "AUDITOR" } | null;
type NavLinkConfig = { href: string; label: string; icon: LucideIcon };

function canSeeAdminLink(link: NavLinkConfig, user: NavUser) {
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  if (user.role === "IT_STAFF") return ["/data-quality", "/photos/compliance", "/labels", "/activity"].includes(link.href);
  if (user.role === "AUDITOR") return ["/data-quality", "/labels", "/activity"].includes(link.href);
  return false;
}

function visibleGroups(user: NavUser) {
  return navGroups
    .map((group) => ({
      ...group,
      links: group.label === "Admin" ? group.links.filter((link) => canSeeAdminLink(link, user)) : group.links,
    }))
    .filter((group) => group.links.length > 0);
}

function hrefPath(href: string) {
  return href.split("?")[0];
}

function isActive(pathname: string, href: string) {
  const path = hrefPath(href);
  return pathname === path || pathname.startsWith(`${path}/`);
}

function NavLink({ link, pathname, compact = false, onNavigate }: { link: { href: string; label: string; icon: LucideIcon }; pathname: string; compact?: boolean; onNavigate?: () => void }) {
  const Icon = link.icon;
  const active = isActive(pathname, link.href);

  return (
    <Link
      href={link.href}
      onClick={onNavigate}
      className={clsx(
        "flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-medium transition active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950",
        compact && "min-h-12 rounded-lg font-semibold",
        active ? "bg-slate-950 text-white shadow-sm" : compact ? "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
      )}
    >
      <Icon size={compact ? 17 : 16} />
      <span className="min-w-0 truncate">{link.label}</span>
    </Link>
  );
}

export function AppNav({ siteName, user }: { siteName: string; user: NavUser }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => setMoreOpen(false), 0);
    return () => window.clearTimeout(timeout);
  }, [pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMoreOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [moreOpen]);

  if (pathname === "/login" || pathname === "/setup-admin") return null;

  const groups = visibleGroups(user);
  const stockLink = navGroups.flatMap((group) => group.links).find((link) => link.href === "/stock")!;
  const taskLink = navGroups.flatMap((group) => group.links).find((link) => link.href === "/tasks")!;
  const mobileLinks = [primaryLinks.find((link) => link.href === "/scan")!, primaryLinks.find((link) => link.href === "/devices")!, stockLink, taskLink];
  const moreActive = [
    primaryLinks.find((link) => link.href === "/dashboard")!,
    primaryLinks.find((link) => link.href === "/alerts")!,
    primaryLinks.find((link) => link.href === "/workspace")!,
    ...groups.flatMap((group) => group.links).filter((link) => !mobileLinks.some((mobile) => mobile.href === link.href)),
  ].some((link) => isActive(pathname, link.href));

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-white">
              <Warehouse size={20} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-950">{siteName}</p>
              <p className="text-xs text-slate-500">{user ? `${user.name} · ${user.role}` : "Inventory Tracker"}</p>
            </div>
          </div>
          <Link
            href="/scan"
            className={clsx(
              "inline-flex min-h-12 items-center gap-2 rounded-full px-4 text-sm font-semibold",
              pathname === "/scan" ? "bg-emerald-700 text-white" : "bg-slate-950 text-white",
            )}
          >
            <ScanLine size={17} />
            Scan
          </Link>
        </div>
      </header>

      <aside className="hidden border-b border-slate-200 bg-white lg:sticky lg:top-0 lg:block lg:h-screen lg:w-64 lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-3 px-4 py-4">
          <div className="flex size-10 items-center justify-center rounded-lg bg-slate-950 text-white">
            <Warehouse size={20} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-950">{siteName}</p>
            <p className="text-xs text-slate-500">{user ? `${user.name} · ${user.role}` : "IT Inventory"}</p>
          </div>
        </div>
        <nav className="space-y-4 overflow-y-auto px-2 pb-4">
          <div className="space-y-1">
            {primaryLinks.map((link) => (
              <NavLink key={link.href} link={link} pathname={pathname} />
            ))}
          </div>

          <div className="space-y-2">
            {groups.map((group) => {
              const groupActive = group.links.some((link) => isActive(pathname, link.href));
              return (
                <details key={group.label} className="group rounded-lg" open={groupActive || undefined}>
                  <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between rounded-md px-3 text-xs font-semibold uppercase tracking-wide text-slate-500 hover:bg-slate-100">
                    {group.label}
                    <ChevronDown className="transition group-open:rotate-180" size={15} />
                  </summary>
                  <div className="mt-1 space-y-1">
                    {group.links.map((link) => (
                      <NavLink key={link.href} link={link} pathname={pathname} />
                    ))}
                  </div>
                </details>
              );
            })}
            {user ? (
              <NavLink link={{ href: "/logout", label: "Sign out", icon: LogOut }} pathname={pathname} />
            ) : null}
          </div>
        </nav>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 pb-[calc(0.35rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden">
        <div className="grid grid-cols-[repeat(5,minmax(0,1fr))] gap-1">
          {mobileLinks.map((link) => {
            const Icon = link.icon;
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  "flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold transition active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950",
                  active ? "bg-slate-950 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100",
                )}
              >
                <Icon size={19} />
                {link.href === "/devices" ? "Inventory" : link.href === "/stock" ? "Stockroom" : link.href === "/tasks" ? "Tasks" : link.href === "/scan" ? "Scan" : link.label}
              </Link>
            );
          })}
          <div className="contents">
            <button
              type="button"
              onClick={() => setMoreOpen((value) => !value)}
              aria-expanded={moreOpen}
              aria-controls="mobile-more-menu"
              className={clsx(
                "flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold transition active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950",
                moreOpen || moreActive ? "bg-slate-950 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100",
              )}
            >
              <MoreHorizontal size={19} />
              More
            </button>
            {moreOpen ? (
              <>
                <button type="button" aria-label="Close navigation menu" className="fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-[1px]" onClick={() => setMoreOpen(false)} />
                <div id="mobile-more-menu" role="dialog" aria-modal="true" aria-label="More navigation" className="fixed inset-x-2 bottom-20 z-50 max-h-[72vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-2xl">
                  <div className="mb-3 flex items-center justify-between gap-3 px-1">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">More tools</p>
                      <p className="text-xs text-slate-500">Less-used modules and admin areas</p>
                    </div>
                    <button ref={closeButtonRef} type="button" onClick={() => setMoreOpen(false)} className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700">
                      Close
                    </button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Start here</p>
                      <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
                        <NavLink link={primaryLinks.find((link) => link.href === "/dashboard")!} pathname={pathname} compact onNavigate={() => setMoreOpen(false)} />
                        <NavLink link={primaryLinks.find((link) => link.href === "/alerts")!} pathname={pathname} compact onNavigate={() => setMoreOpen(false)} />
                        <NavLink link={primaryLinks.find((link) => link.href === "/workspace")!} pathname={pathname} compact onNavigate={() => setMoreOpen(false)} />
                      </div>
                    </div>
                    {groups.map((group) => {
                      const links = group.links.filter((link) => !mobileLinks.some((mobile) => mobile.href === link.href));
                      if (!links.length) return null;
                      return (
                        <div key={group.label}>
                          <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{group.label}</p>
                          <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
                            {links.map((link) => (
                              <NavLink key={link.href} link={link} pathname={pathname} compact onNavigate={() => setMoreOpen(false)} />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    {user ? <NavLink link={{ href: "/logout", label: "Sign out", icon: LogOut }} pathname={pathname} compact onNavigate={() => setMoreOpen(false)} /> : null}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </nav>
    </>
  );
}
