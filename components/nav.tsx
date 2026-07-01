"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Activity, AlertTriangle, BarChart3, BriefcaseBusiness, Camera, ChevronDown, ClipboardCheck, ClipboardList, Database, ExternalLink, FileSpreadsheet, LayoutDashboard, ListChecks, LogOut, Map, MapPinned, Menu, Package, PackageCheck, PackagePlus, Palette, Radar, ReceiptText, RotateCcw, Router, ScanLine, SearchX, Settings, ShieldCheck, Tags, Users, Wrench, X, type LucideIcon } from "lucide-react";
import { clsx } from "clsx";
import { LanguageSwitcher } from "@/components/language-switcher";
import { navText, type Locale } from "@/lib/i18n";

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
      { href: "/admin", label: "Admin Center", icon: ShieldCheck },
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
type NavGroupConfig = { label: string; links: NavLinkConfig[] };

const linkTranslationKeys: Record<string, keyof typeof navText.en.links> = {
  "/dashboard": "dashboard",
  "/scan": "quickScan",
  "/devices": "inventory",
  "/alerts": "alerts",
  "/workspace": "itWorkspace",
  "/intake": "intake",
  "/assignments": "assignments",
  "/loans": "assetLoans",
  "/rma": "rma",
  "/stock": "stockroom",
  "/stock/issue": "stockIssue",
  "/stock/issues": "issueHistory",
  "/maintenance": "maintenance",
  "/tasks": "tasks",
  "/po-tracker": "poTracker",
  "/reports": "reports",
  "/tools": "resources",
  "/offline": "offlineQueue",
  "/offline/conflicts": "offlineConflicts",
  "/employees": "employees",
  "/temporary-borrowers": "temporaryBorrowers",
  "/facturas": "facturas",
  "/map": "map",
  "/zones": "zones",
  "/missing": "missing",
  "/admin": "adminCenter",
  "/settings": "settings",
  "/admin/ui-preview": "uiPreview",
  "/admin/users": "users",
  "/import/legacy-sheet": "legacyImport",
  "/data-quality": "dataQuality",
  "/photos/compliance": "photoCompliance",
  "/labels": "labels",
  "/backups": "backups",
  "/jobs": "jobs",
  "/ranges": "ranges",
  "/scanner": "scanner",
  "/conflicts": "conflicts",
  "/activity": "activity",
};

const groupTranslationKeys: Record<string, keyof typeof navText.en.groups> = {
  Workflows: "workflows",
  Workspace: "workspace",
  Records: "records",
  Admin: "admin",
};

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

function localizeLink(link: NavLinkConfig, locale: Locale): NavLinkConfig {
  const key = linkTranslationKeys[link.href];
  return key ? { ...link, label: navText[locale].links[key] } : link;
}

function localizeGroups(groups: NavGroupConfig[], locale: Locale): NavGroupConfig[] {
  return groups.map((group) => {
    const key = groupTranslationKeys[group.label];
    return {
      label: key ? navText[locale].groups[key] : group.label,
      links: group.links.map((link) => localizeLink(link, locale)),
    };
  });
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
  const isLogout = link.href === "/logout";

  return (
    <Link
      href={link.href}
      prefetch={isLogout ? false : undefined}
      onClick={onNavigate}
      className={clsx(
        "flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-medium transition active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950",
        compact && "min-h-12 rounded-lg font-semibold",
        active
          ? compact
            ? "bg-slate-950 text-white shadow-sm"
            : "bg-slate-800/50 text-white border-l-2 border-orange-500 pl-[10px] shadow-[inset_1px_0_0_rgba(255,255,255,0.05)]"
          : compact
            ? "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
            : "text-slate-400 hover:bg-slate-900/40 hover:text-white"
      )}
    >
      <Icon size={compact ? 17 : 16} className={clsx(active && !compact && "text-orange-500")} />
      <span className="min-w-0 truncate">{link.label}</span>
    </Link>
  );
}

function NavMenuContent({
  groups,
  pathname,
  user,
  locale,
  compact = false,
  onNavigate,
}: {
  groups: NavGroupConfig[];
  pathname: string;
  user: NavUser;
  locale: Locale;
  compact?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div className="space-y-1">
        {primaryLinks.map((link) => {
          const localized = localizeLink(link, locale);
          return <NavLink key={link.href} link={localized} pathname={pathname} compact={compact} onNavigate={onNavigate} />;
        })}
      </div>

      <div className="space-y-2">
        {groups.map((group) => {
          const groupActive = group.links.some((link) => isActive(pathname, link.href));
          return (
            <details key={group.label} className="group rounded-lg" open={groupActive || compact || undefined}>
              <summary className={clsx(
                "flex min-h-10 cursor-pointer list-none items-center justify-between rounded-md px-3 text-xs font-semibold uppercase tracking-wide transition-colors",
                compact
                  ? "text-slate-500 hover:bg-slate-100"
                  : "text-slate-500 hover:bg-slate-900/30 hover:text-slate-300"
              )}>
                {group.label}
                <ChevronDown className="transition group-open:rotate-180" size={15} />
              </summary>
              <div className="mt-1 space-y-1">
                {group.links.map((link) => (
                  <NavLink key={link.href} link={link} pathname={pathname} compact={compact} onNavigate={onNavigate} />
                ))}
              </div>
            </details>
          );
        })}
        {user ? (
          <NavLink link={{ href: "/logout", label: navText[locale].links.signOut, icon: LogOut }} pathname={pathname} compact={compact} onNavigate={onNavigate} />
        ) : null}
        {user ? <LanguageSwitcher locale={locale} label={navText[locale].language} compact={compact} /> : null}
      </div>
    </>
  );
}

export function GGlobalLogo({ className }: { className?: string }) {
  return (
    <svg className={className} width="32" height="32" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="42" stroke="#3B82F6" strokeWidth="4" strokeDasharray="4 4" opacity="0.3" />
      <path d="M50 8 A42 42 0 0 0 50 92" stroke="#3B82F6" strokeWidth="3" strokeDasharray="3 3" opacity="0.25" />
      <path d="M8 50 A42 42 0 0 0 92 50" stroke="#3B82F6" strokeWidth="3" strokeDasharray="3 3" opacity="0.25" />
      <path 
        d="M78 30 C70 18, 50 15, 34 25 C18 35, 12 55, 22 72 C32 88, 55 92, 70 82 C82 74, 88 58, 82 44 L66 48 C70 56, 66 68, 58 74 C50 80, 36 78, 28 68 C20 58, 24 44, 34 38 C44 32, 56 34, 62 42 L48 42 L48 56 L88 56 L88 20 L78 30 Z" 
        fill="#3B82F6" 
      />
      <path 
        d="M62 25 L88 12 L70 38 L84 40 L45 85 L58 52 L42 50 Z" 
        fill="#FF4500" 
      />
    </svg>
  );
}

export function AppNav({ siteName, user, locale }: { siteName: string; user: NavUser; locale: Locale }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDrawerOpen(false), 0);
    return () => window.clearTimeout(timeout);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setDrawerOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [drawerOpen]);

  if (pathname === "/login" || pathname === "/setup-admin") return null;

  const localizedPrimaryLinks = primaryLinks.map((link) => localizeLink(link, locale));
  const groups = localizeGroups(visibleGroups(user), locale);
  const stockLink = groups.flatMap((group) => group.links).find((link) => link.href === "/stock")!;
  const taskLink = groups.flatMap((group) => group.links).find((link) => link.href === "/tasks")!;
  const mobileLinks = [localizedPrimaryLinks.find((link) => link.href === "/scan")!, localizedPrimaryLinks.find((link) => link.href === "/devices")!, stockLink, taskLink];
  const moreActive = [
    localizedPrimaryLinks.find((link) => link.href === "/dashboard")!,
    localizedPrimaryLinks.find((link) => link.href === "/alerts")!,
    localizedPrimaryLinks.find((link) => link.href === "/workspace")!,
    ...groups.flatMap((group) => group.links).filter((link) => !mobileLinks.some((mobile) => mobile.href === link.href)),
  ].some((link) => isActive(pathname, link.href));

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation"
              aria-expanded={drawerOpen}
              aria-controls="mobile-sidebar-drawer"
              className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
            >
              <Menu size={20} />
            </button>
            <div className="hidden size-10 shrink-0 items-center justify-center rounded-lg bg-slate-900 border border-slate-800 shadow-sm min-[360px]:flex">
              <GGlobalLogo className="size-8" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-950">{siteName}</p>
              <p className="text-xs text-slate-500">{user ? `${user.name} / ${user.role}` : "Inventory Tracker"}</p>
            </div>
          </div>
          <Link
            href="/scan"
            className={clsx(
              "inline-flex min-h-12 items-center gap-2 rounded-full px-4 text-sm font-semibold text-white",
              pathname === "/scan" ? "bg-emerald-700" : "bg-slate-950",
            )}
          >
            <ScanLine size={17} />
            Scan
          </Link>
        </div>
      </header>

      <aside className="hidden border-r border-slate-900 bg-[#0B0F19] lg:sticky lg:top-0 lg:flex lg:flex-col lg:h-screen lg:w-64">
        <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-900/60 shadow-sm">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-900/50 border border-slate-800/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            <GGlobalLogo className="size-8" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white truncate tracking-wide">{siteName}</p>
            <p className="text-xs text-slate-400 truncate">{user ? `${user.name} / ${user.role}` : "IT Inventory"}</p>
          </div>
        </div>
        <nav className="min-h-0 flex-1 space-y-4 overflow-y-auto px-2 py-4">
          <NavMenuContent groups={groups} pathname={pathname} user={user} locale={locale} />
        </nav>
      </aside>

      {drawerOpen ? (
        <>
          <button type="button" aria-label="Close navigation menu" className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-[1px] lg:hidden" onClick={() => setDrawerOpen(false)} />
          <aside
            id="mobile-sidebar-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            className="fixed inset-y-0 left-0 z-50 flex w-[min(22rem,calc(100vw-2rem))] max-w-full animate-[mobile-drawer-in_180ms_ease-out] flex-col border-r border-slate-200 bg-white shadow-2xl lg:hidden"
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-900 border border-slate-800">
                  <GGlobalLogo className="size-8" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-950">{siteName}</p>
                  <p className="truncate text-xs text-slate-500">Navigation</p>
                </div>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close navigation"
                className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-slate-300 text-slate-700 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
              >
                <X size={20} />
              </button>
            </div>
            <nav className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 pb-28 pt-3">
              <NavMenuContent groups={groups} pathname={pathname} user={user} locale={locale} compact onNavigate={() => setDrawerOpen(false)} />
            </nav>
          </aside>
        </>
      ) : null}

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
                {link.href === "/devices" ? navText[locale].links.inventory : link.href === "/stock" ? navText[locale].links.stockMobile : link.href === "/tasks" ? navText[locale].links.tasksMobile : link.href === "/scan" ? navText[locale].links.scanMobile : link.label}
              </Link>
            );
          })}
          <div className="contents">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation"
              aria-expanded={drawerOpen}
              aria-controls="mobile-sidebar-drawer"
              className={clsx(
                "flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-semibold transition active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950",
                drawerOpen || moreActive ? "bg-slate-950 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100",
              )}
            >
              <Menu size={19} />
              {locale === "es" ? "Menú" : "Menu"}
            </button>
          </div>
        </div>
      </nav>
    </>
  );
}
